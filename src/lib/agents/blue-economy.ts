import { PFZAdvisoryResult } from '../types/domain';
import { AgentStep } from '../types/agents';
import { getPFZAdvisories } from '../tools/incois-pfz';

export interface BlueEconomyResult {
  pfz: PFZAdvisoryResult;
  habitatSuitabilityScore: number; // 0.0 to 1.0
  targetPelagicSpecies: string[];
  findings: string[];
  steps: AgentStep[];
}

export async function runBlueEconomyAgent(
  regionName: string,
  currentSSTCelsius?: number
): Promise<BlueEconomyResult> {
  const steps: AgentStep[] = [];
  const findings: string[] = [];

  steps.push({
    agentName: 'BlueEconomy',
    action: 'Analyze Potential Fishing Zones & Habitat Suitability',
    status: 'executing',
    detail: `Querying INCOIS PFZ guidelines and calculating pelagic Habitat Suitability Index for ${regionName}`,
    timestamp: new Date().toISOString(),
  });

  const pfz = await getPFZAdvisories(regionName);

  // Compute Habitat Suitability Index (HSI) based on optimal thermal range for Indian pelagics (27.0 - 29.5°C)
  let hsi = 0.75;
  if (currentSSTCelsius !== undefined) {
    if (currentSSTCelsius >= 27.5 && currentSSTCelsius <= 29.5) {
      hsi = 0.92; // Peak upwelling thermal break
    } else if (currentSSTCelsius > 31.0) {
      hsi = 0.45; // Thermal stratification / lower oxygen
    } else {
      hsi = 0.65;
    }
  }

  const allSpecies = Array.from(new Set(pfz.zones.flatMap((z) => z.targetSpecies)));
  findings.push(`Habitat Suitability Index (HSI): ${(hsi * 100).toFixed(0)}% favorable for pelagic aggregation.`);
  findings.push(`Identified ${pfz.zones.length} active fishing zones in ${regionName}. Target species: ${allSpecies.slice(0, 4).join(', ')}.`);

  steps.push({
    agentName: 'BlueEconomy',
    action: 'HSI & PFZ Synthesis Complete',
    status: 'completed',
    detail: `HSI: ${(hsi * 100).toFixed(0)}%. ${pfz.zones.length} zones cataloged.`,
    timestamp: new Date().toISOString(),
  });

  return {
    pfz,
    habitatSuitabilityScore: hsi,
    targetPelagicSpecies: allSpecies,
    findings,
    steps,
  };
}
