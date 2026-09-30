import * as turf from '@turf/turf';
import { GeoCoordinate, RouteResult, RoutePassageWaypoint } from '../domain/models';
import { checkGeofence } from '../geo/boundaries';
import { getMarineService } from './marine.service';

export class RouteService {
  private marineService = getMarineService();

  async computePassageCorridor(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    originName: string = 'Departure Port',
    destinationName: string = 'Destination Sector',
    vesselSpeedKmh: number = 22 // ~12 knots
  ): Promise<RouteResult> {
    const from = turf.point([origin.longitude, origin.latitude]);
    const to = turf.point([destination.longitude, destination.latitude]);

    const totalDistanceKm = Math.round(turf.distance(from, to, { units: 'kilometers' }) * 10) / 10;
    const estimatedHours = Math.round((totalDistanceKm / vesselSpeedKmh) * 10) / 10;

    const numSteps = 5;
    const waypoints: RoutePassageWaypoint[] = [];
    const lineCoords: [number, number][] = [[origin.longitude, origin.latitude]];

    // Origin check
    waypoints.push({
      coordinate: { ...origin },
      distanceFromOriginKm: 0,
      geofenceCheck: { ...checkGeofence(origin), coordinate: origin },
    });

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
      lineCoords.push([lon, lat]);

      const geofence = checkGeofence(coord);
      waypoints.push({
        coordinate: coord,
        distanceFromOriginKm: Math.round(totalDistanceKm * fraction * 10) / 10,
        geofenceCheck: { ...geofence, coordinate: coord },
      });
    }

    // Destination check
    lineCoords.push([destination.longitude, destination.latitude]);
    waypoints.push({
      coordinate: { ...destination },
      distanceFromOriginKm: totalDistanceKm,
      geofenceCheck: { ...checkGeofence(destination), coordinate: destination },
    });

    // Check origin marine weather for wave hazard
    let waveWarning = false;
    try {
      const obs = await this.marineService.getMarineObservation(origin, originName);
      if (obs.wave.heightMeters >= 2.5 || obs.wind.gustsKmh >= 45) {
        waveWarning = true;
      }
    } catch {
      // Non-blocking fallback
    }

    // Risk aggregation
    const hasViolation = waypoints.some(
      (w) =>
        w.geofenceCheck.riskStatus === 'Restricted Zone Violation' ||
        w.geofenceCheck.riskStatus === 'Border Proximity Warning'
    );
    const hasCaution = waypoints.some((w) => w.geofenceCheck.riskStatus === 'Caution');

    let overallSafety: RouteResult['overallSafety'] = 'Safe';
    let advisory = '';

    if (hasViolation) {
      overallSafety = 'High Risk';
      advisory = `Warning: Passage corridor between ${originName} and ${destinationName} intersects restricted marine reserves or approaches within 12 km of international borders.`;
    } else if (hasCaution || waveWarning) {
      overallSafety = 'Caution';
      advisory = waveWarning
        ? `Caution: Elevated wave/wind sea state observed along departure sector. Exercise heightened situational awareness.`
        : `Caution: Corridor transits within 35 km buffer of international boundary lines. Maintain continuous radio and AIS broadcast.`;
    } else {
      overallSafety = 'Safe';
      advisory = `Passage plan verified clear of international maritime boundaries and marine protected reserves. Total transit: ${totalDistanceKm} km (~${estimatedHours} hours at ${vesselSpeedKmh} km/h).`;
    }

    return {
      origin,
      destination,
      originName,
      destinationName,
      totalDistanceKm,
      estimatedTravelTimeHours: estimatedHours,
      waypoints,
      routeGeometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
      overallSafety,
      advisory,
    };
  }
}

// Singleton instance
const GLOBAL_ROUTE_SERVICE_KEY = '__aurexo_route_service__';
export function getRouteService(): RouteService {
  const g = globalThis as unknown as Record<string, RouteService | undefined>;
  if (!g[GLOBAL_ROUTE_SERVICE_KEY]) {
    g[GLOBAL_ROUTE_SERVICE_KEY] = new RouteService();
  }
  return g[GLOBAL_ROUTE_SERVICE_KEY]!;
}
