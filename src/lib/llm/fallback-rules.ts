import { MarineObservation, GeofenceCheckResult, PFZAdvisoryResult } from '../types/domain';

/**
 * Deterministic rule-based explanation engine.
 * Guaranteed zero-hallucination fallback that converts verified observations into
 * clear, professional maritime intelligence answers if all LLM APIs are unreachable.
 */
export function generateRuleBasedResponse(
  intent: string,
  data: {
    conditions?: MarineObservation;
    geofence?: GeofenceCheckResult;
    pfz?: PFZAdvisoryResult;
    route?: any;
    hazards?: any[];
  }
): string {
  const parts: string[] = [];

  if (data.conditions) {
    const c = data.conditions;
    parts.push(
      `**Verified Marine Observation for ${c.locationName}** (Retrieved: ${c.observationTime}):`
    );
    parts.push(
      `• **Sea State**: Wave height is ${c.wave.heightMeters.toFixed(1)}m (${c.wave.category}) with a swell period of ${c.wave.periodSeconds.toFixed(1)}s.`
    );
    parts.push(
      `• **Wind**: ${c.wind.speedKmh.toFixed(1)} km/h (${c.wind.beaufortDescription}, Beaufort force ${c.wind.beaufortScale}) gusting to ${c.wind.gustsKmh.toFixed(1)} km/h.`
    );
    parts.push(
      `• **Sea Surface Temperature (SST)**: ${c.seaSurfaceTemperatureCelsius.toFixed(1)}°C.`
    );
    parts.push(
      `• **Ocean Currents**: Velocity of ${c.currents.velocityKmh.toFixed(1)} km/h at heading ${c.currents.directionDegrees}°.`
    );
    parts.push(
      `• **Safety Assessment**: ${c.isSafeForSmallCraft ? 'SAFE for small fishing vessels.' : 'CAUTION: Hazardous conditions for small craft.'} ${c.advisoryText}`
    );
  }

  if (data.geofence) {
    const g = data.geofence;
    parts.push(`\n**Geospatial & Boundary Sentinel Evaluation**:`);
    parts.push(`• **Status**: [${g.riskStatus.toUpperCase()}]`);
    parts.push(`• **IMBL Proximity**: Distance to nearest international boundary (${g.nearestNeighborCountry}) is **${g.distanceToIMBLKm} km**.`);
    if (g.isInsideMarineProtectedArea) {
      parts.push(`• **Protected Zone Alert**: Vessel coordinate falls within ${g.protectedAreaName}. Commercial fishing and bottom trawling are strictly banned under the Wildlife Protection Act.`);
    }
    parts.push(`• **Tactical Guidance**: ${g.notes}`);
  }

  if (data.pfz) {
    const p = data.pfz;
    parts.push(`\n**Potential Fishing Zones (PFZ Guidelines)**:`);
    parts.push(`*Note: ${p.message}*`);
    p.zones.slice(0, 3).forEach((z, i) => {
      parts.push(
        `${i + 1}. **${z.name}** (~${z.distanceFromCoastKm} km offshore, depth: ${z.depthMeters}m). Target species: ${z.targetSpecies.join(', ')}. Chlorophyll indicator: ${z.chlorophyllStatus}.`
      );
    });
  }

  if (data.route) {
    const r = data.route;
    parts.push(`\n**Navigational Passage Corridor**:`);
    parts.push(`• Total Distance: **${r.totalDistanceKm} km** (~${r.estimatedTravelTimeHours} hours at 12 knots).`);
    parts.push(`• Overall Corridor Risk: **${r.overallSafety}**.`);
    parts.push(`• Routing Advisory: ${r.advisory}`);
  }

  if (parts.length === 0) {
    return `Aurexo has received your inquiry regarding marine conditions. Please provide specific coordinates or select a coastal location to retrieve verified oceanographic observations and boundary compliance assessments.`;
  }

  return parts.join('\n');
}
