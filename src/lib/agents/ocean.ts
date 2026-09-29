import { GeoCoordinate, MarineObservation, SatelliteLayerId } from '../types/domain';
import { AgentStep } from '../types/agents';
import { fetchMarineConditions } from '../tools/marine-conditions';

export interface OceanAgentResult {
  observation?: MarineObservation;
  recommendedLayer: SatelliteLayerId;
  findings: string[];
  steps: AgentStep[];
}

export async function runOceanAgent(
  coordinate: GeoCoordinate,
  locationName: string,
  wantsChlorophyll: boolean = false
): Promise<OceanAgentResult> {
  const steps: AgentStep[] = [];
  const findings: string[] = [];

  steps.push({
    agentName: 'Ocean',
    action: 'Query Sea Surface Temperature & Ocean Currents',
    status: 'executing',
    detail: `Querying live oceanographic measurements for ${locationName} (${coordinate.latitude}°N, ${coordinate.longitude}°E)`,
    timestamp: new Date().toISOString(),
  });

  let observation: MarineObservation | undefined;
  let recommendedLayer: SatelliteLayerId = wantsChlorophyll ? 'chlorophyll' : 'sst';

  try {
    observation = await fetchMarineConditions(coordinate, locationName);
    const sst = observation.seaSurfaceTemperatureCelsius;
    const currentVel = observation.currents.velocityKmh;

    findings.push(`Retrieved Sea Surface Temperature (SST): ${sst.toFixed(1)}°C.`);
    findings.push(`Current velocity: ${currentVel.toFixed(1)} km/h heading ${observation.currents.directionDegrees}°.`);

    steps.push({
      agentName: 'Ocean',
      action: 'Ocean Data Retrieved',
      status: 'completed',
      detail: `SST ${sst.toFixed(1)}°C, currents ${currentVel.toFixed(1)} km/h. Recommending ${recommendedLayer} layer.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    steps.push({
      agentName: 'Ocean',
      action: 'Ocean Query Failed',
      status: 'flagged',
      detail: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
  }

  return { observation, recommendedLayer, findings, steps };
}
