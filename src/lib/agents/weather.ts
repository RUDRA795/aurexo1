import { GeoCoordinate, MarineObservation } from '../types/domain';
import { AgentStep } from '../types/agents';
import { fetchMarineConditions } from '../tools/marine-conditions';
import { getMarineHazards } from '../tools/marine-hazards';

export interface WeatherAgentResult {
  waveHeightMeters: number;
  waveCategory: string;
  swellPeriodSeconds: number;
  windSpeedKmh: number;
  beaufortScale: number;
  beaufortDescription: string;
  isSeaRough: boolean;
  activeHazardsCount: number;
  findings: string[];
  steps: AgentStep[];
}

export async function runWeatherAgent(
  coordinate: GeoCoordinate,
  locationName: string,
  cachedObservation?: MarineObservation
): Promise<WeatherAgentResult> {
  const steps: AgentStep[] = [];
  const findings: string[] = [];

  steps.push({
    agentName: 'WeatherHazard',
    action: 'Scan Wave Dynamics & Atmospheric Wind Shear',
    status: 'executing',
    detail: `Analyzing wave heights, swell periods, and gale wind thresholds for ${locationName}`,
    timestamp: new Date().toISOString(),
  });

  const obs = cachedObservation ?? (await fetchMarineConditions(coordinate, locationName));
  const wave = obs.wave.heightMeters;
  const period = obs.wave.periodSeconds;
  const wind = obs.wind.speedKmh;
  const beaufort = obs.wind.beaufortScale;
  const isSeaRough = wave >= 2.0 || wind >= 35;

  findings.push(`Significant wave height: ${wave.toFixed(1)}m (${obs.wave.category}) with ${period.toFixed(1)}s swell period.`);
  findings.push(`Wind speed: ${wind.toFixed(1)} km/h (${obs.wind.beaufortDescription}, Beaufort ${beaufort}).`);

  if (period >= 14 && wave >= 1.2) {
    findings.push(`⚠️ Kallakkadal warning: Long-period swell surge (${period.toFixed(1)}s) detected without local wind.`);
  }

  // Scan hazards
  let hazardsCount = 0;
  try {
    const hazards = await getMarineHazards(coordinate, locationName);
    hazardsCount = hazards.length;
    if (hazards.some((h) => h.severity === 'Warning' || h.severity === 'Emergency')) {
      findings.push(`Active severe marine alert issued for this sector.`);
    }
  } catch (err) {
    console.error('Weather agent hazard error:', err);
  }

  steps.push({
    agentName: 'WeatherHazard',
    action: 'Sea State Assessment Complete',
    status: isSeaRough ? 'flagged' : 'completed',
    detail: `Wave ${wave.toFixed(1)}m, Wind ${wind.toFixed(0)} km/h. Sea state is ${isSeaRough ? 'ROUGH' : 'CALM/MODERATE'}.`,
    timestamp: new Date().toISOString(),
  });

  return {
    waveHeightMeters: wave,
    waveCategory: obs.wave.category,
    swellPeriodSeconds: period,
    windSpeedKmh: wind,
    beaufortScale: beaufort,
    beaufortDescription: obs.wind.beaufortDescription,
    isSeaRough,
    activeHazardsCount: hazardsCount,
    findings,
    steps,
  };
}
