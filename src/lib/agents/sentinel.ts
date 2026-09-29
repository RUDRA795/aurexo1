import { GeoCoordinate, GeofenceCheckResult } from '../types/domain';
import { AgentStep } from '../types/agents';
import { checkGeofence } from '../geo/boundaries';

export interface SentinelAgentResult {
  geofence: GeofenceCheckResult;
  findings: string[];
  steps: AgentStep[];
}

export function runSentinelAgent(
  coordinate: GeoCoordinate,
  locationName: string
): SentinelAgentResult {
  const steps: AgentStep[] = [];
  const findings: string[] = [];

  steps.push({
    agentName: 'SpatialSentinel',
    action: 'Evaluate Maritime Borders & Marine Protected Areas',
    status: 'executing',
    detail: `Calculating Turf.js distance to nearest IMBL and checking MPA polygons for ${locationName}`,
    timestamp: new Date().toISOString(),
  });

  const geofence = checkGeofence(coordinate);

  findings.push(`Distance to ${geofence.nearestNeighborCountry} IMBL: ${geofence.distanceToIMBLKm} km.`);
  if (geofence.isInsideMarineProtectedArea) {
    findings.push(`🚨 CRITICAL: Location falls inside ${geofence.protectedAreaName}. Trawling prohibited.`);
  } else if (geofence.riskStatus === 'Border Proximity Warning') {
    findings.push(`⚠️ WARNING: Critical proximity (${geofence.distanceToIMBLKm} km) to ${geofence.nearestNeighborCountry} maritime border.`);
  } else if (geofence.riskStatus === 'Caution') {
    findings.push(`Notice: Operating within ${geofence.distanceToIMBLKm} km frontier buffer of ${geofence.nearestNeighborCountry}.`);
  } else {
    findings.push(`Territorial integrity: Vessel is safely within Indian EEZ waters.`);
  }

  steps.push({
    agentName: 'SpatialSentinel',
    action: 'Geopolitical Risk Determined',
    status: geofence.riskStatus === 'Safe' ? 'completed' : 'flagged',
    detail: `IMBL distance: ${geofence.distanceToIMBLKm} km. Status: ${geofence.riskStatus}.`,
    timestamp: new Date().toISOString(),
  });

  return { geofence, findings, steps };
}
