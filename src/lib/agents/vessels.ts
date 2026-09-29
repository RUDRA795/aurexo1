import { GeoCoordinate } from '../types/domain';
import { MarineVessel, NearestVesselResult } from '../types/vessel';
import { AgentStep } from '../types/agents';
import {
  getAllVessels,
  findNearestVessel,
  findVesselByNameOrMMSI,
} from '../tools/vessels';

export interface VesselAgentResult {
  vessels: MarineVessel[];
  nearestVessel?: NearestVesselResult;
  matchedVessel?: MarineVessel;
  findings: string[];
  steps: AgentStep[];
}

export function runVesselAgent(
  prompt: string,
  referenceCoord: GeoCoordinate,
  locationName: string
): VesselAgentResult {
  const steps: AgentStep[] = [];
  const findings: string[] = [];
  const promptLower = prompt.toLowerCase();

  steps.push({
    agentName: 'Vessel',
    action: 'Query AIS Fleet Registry',
    status: 'executing',
    detail: `Searching vessel fleet and computing spatial bearings relative to ${locationName}`,
    timestamp: new Date().toISOString(),
  });

  const fleet = getAllVessels();
  let nearestVessel: NearestVesselResult | undefined;
  let matchedVessel: MarineVessel | undefined;

  // Check for specific vessel search
  for (const v of fleet) {
    if (promptLower.includes(v.name.toLowerCase()) || promptLower.includes(v.mmsi)) {
      matchedVessel = v;
      break;
    }
  }

  if (matchedVessel) {
    findings.push(
      `Located ${matchedVessel.name} (${matchedVessel.vesselType}, MMSI: ${matchedVessel.mmsi}) at [${matchedVessel.coordinates.latitude.toFixed(2)}°N, ${matchedVessel.coordinates.longitude.toFixed(2)}°E]. Speed: ${matchedVessel.speedKnots} kts heading ${matchedVessel.headingDegrees}°. Destination: ${matchedVessel.destination}.`
    );
    steps.push({
      agentName: 'Vessel',
      action: 'Vessel Match Located',
      status: 'completed',
      detail: `Found ${matchedVessel.name} (Source: ${matchedVessel.sourceStatus})`,
      timestamp: new Date().toISOString(),
    });
  } else if (promptLower.includes('closest') || promptLower.includes('nearest') || promptLower.includes('where')) {
    // Proximity calculation
    const nearest = findNearestVessel(referenceCoord);
    if (nearest) {
      nearestVessel = nearest;
      findings.push(
        `Nearest vessel to ${locationName} is ${nearest.vessel.name} (${nearest.vessel.vesselType}), located ${nearest.distanceKm} km (${nearest.distanceNauticalMiles} NM) bearing ${nearest.bearingDegrees}° at speed ${nearest.vessel.speedKnots} kts.`
      );
      steps.push({
        agentName: 'Vessel',
        action: 'Nearest Vessel Calculated',
        status: 'completed',
        detail: `${nearest.vessel.name} is ${nearest.distanceKm} km away.`,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    findings.push(
      `Currently tracking ${fleet.length} active vessels across the Indian EEZ (Research, Coast Guard Patrol, and Fishing Fleets).`
    );
    steps.push({
      agentName: 'Vessel',
      action: 'Fleet Overview Assembled',
      status: 'completed',
      detail: `${fleet.length} vessels in registry.`,
      timestamp: new Date().toISOString(),
    });
  }

  return { vessels: fleet, nearestVessel, matchedVessel, findings, steps };
}
