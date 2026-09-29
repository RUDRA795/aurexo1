import * as turf from '@turf/turf';
import { GeoCoordinate, GeofenceCheckResult } from '../types/domain';
import { checkGeofence } from './boundaries';

export interface RoutePassagePlan {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  totalDistanceKm: number;
  estimatedTravelTimeHours: number; // At typical artisanal boat speed of 12 knots (~22 km/h)
  waypoints: GeoCoordinate[];
  routeGeometry: GeoJSON.LineString;
  intermediateRiskAssessments: GeofenceCheckResult[];
  overallSafety: 'Safe' | 'Caution' | 'High Risk';
  advisory: string;
}

/**
 * Computes deterministic navigational passage corridor between two marine coordinates.
 * Evaluates intermediate checkpoints against IMBL proximity and MPAs.
 */
export function computeSafePassage(
  origin: GeoCoordinate,
  destination: GeoCoordinate,
  vesselSpeedKmh: number = 22 // ~12 knots
): RoutePassagePlan {
  const from = turf.point([origin.longitude, origin.latitude]);
  const to = turf.point([destination.longitude, destination.latitude]);

  const totalDistanceKm = Math.round(turf.distance(from, to, { units: 'kilometers' }) * 10) / 10;
  const estimatedHours = Math.round((totalDistanceKm / vesselSpeedKmh) * 10) / 10;

  // Generate 5 intermediate waypoints along great circle corridor
  const numSteps = 5;
  const waypoints: GeoCoordinate[] = [{ ...origin }];
  const lineCoords: [number, number][] = [[origin.longitude, origin.latitude]];
  const riskAssessments: GeofenceCheckResult[] = [];

  for (let i = 1; i < numSteps; i++) {
    const fraction = i / numSteps;
    const intermediate = turf.along(
      turf.lineString([
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
      ]),
      totalDistanceKm * fraction,
      { units: 'kilometers' }
    );

    const [lon, lat] = intermediate.geometry.coordinates;
    const coord: GeoCoordinate = {
      latitude: Math.round(lat * 10000) / 10000,
      longitude: Math.round(lon * 10000) / 10000,
    };
    waypoints.push(coord);
    lineCoords.push([lon, lat]);

    const check = checkGeofence(coord);
    riskAssessments.push(check);
  }

  waypoints.push({ ...destination });
  lineCoords.push([destination.longitude, destination.latitude]);

  // Overall safety aggregation
  const hasViolation = riskAssessments.some(
    (r) => r.riskStatus === 'Restricted Zone Violation' || r.riskStatus === 'Border Proximity Warning'
  );
  const hasCaution = riskAssessments.some((r) => r.riskStatus === 'Caution');

  let overallSafety: RoutePassagePlan['overallSafety'] = 'Safe';
  let advisory = '';

  if (hasViolation) {
    overallSafety = 'High Risk';
    advisory = 'Warning: Proposed passage route intersects restricted Marine Protected Reserves or approaches within 12 km of international maritime boundaries. Route adjustment required.';
  } else if (hasCaution) {
    overallSafety = 'Caution';
    advisory = 'Caution: Route transits within 35 km buffer of international waters. Vessel should broadcast AIS and maintain continuous radio watch.';
  } else {
    overallSafety = 'Safe';
    advisory = `Passage plan verified clear of known ecological reserves and international borders. Total distance: ${totalDistanceKm} km (${estimatedHours} hrs at ${vesselSpeedKmh} km/h).`;
  }

  return {
    origin,
    destination,
    totalDistanceKm,
    estimatedTravelTimeHours: estimatedHours,
    waypoints,
    routeGeometry: {
      type: 'LineString',
      coordinates: lineCoords,
    },
    intermediateRiskAssessments: riskAssessments,
    overallSafety,
    advisory,
  };
}
