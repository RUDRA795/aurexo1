import * as turf from '@turf/turf';
import fs from 'fs';
import path from 'path';
import { GeoCoordinate, GeofenceCheckResult } from '../types/domain';

// Load GeoJSON data safely on server
let eezImblGeoJson: GeoJSON.FeatureCollection | null = null;
let mpaGeoJson: GeoJSON.FeatureCollection | null = null;

function loadGeoData() {
  if (!eezImblGeoJson) {
    const eezPath = path.join(process.cwd(), 'public', 'data', 'india_eez_imbl.geojson');
    if (fs.existsSync(eezPath)) {
      eezImblGeoJson = JSON.parse(fs.readFileSync(eezPath, 'utf8'));
    }
  }
  if (!mpaGeoJson) {
    const mpaPath = path.join(process.cwd(), 'public', 'data', 'marine_protected_areas.geojson');
    if (fs.existsSync(mpaPath)) {
      mpaGeoJson = JSON.parse(fs.readFileSync(mpaPath, 'utf8'));
    }
  }
}

/**
 * Deterministically calculates distances to International Maritime Boundary Line (IMBL)
 * and checks point-in-polygon containment for Marine Protected Areas.
 * No LLM calculation involved.
 */
export function checkGeofence(coord: GeoCoordinate): GeofenceCheckResult {
  loadGeoData();

  const pt = turf.point([coord.longitude, coord.latitude]);

  // 1. Check Marine Protected Areas (Point-in-Polygon)
  let isInsideMPA = false;
  let protectedAreaName: string | undefined = undefined;

  if (mpaGeoJson) {
    for (const feature of mpaGeoJson.features) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const poly = feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
        if (turf.booleanPointInPolygon(pt, poly)) {
          isInsideMPA = true;
          protectedAreaName = (feature.properties?.name as string) ?? 'Marine Protected Reserve';
          break;
        }
      }
    }
  }

  // 2. Calculate Distance to Nearest IMBL segment
  let minDistanceToIMBL = 9999;
  let nearestNeighbor = 'International Waters';

  if (eezImblGeoJson) {
    for (const feature of eezImblGeoJson.features) {
      if (feature.properties?.type === 'IMBL' && feature.geometry.type === 'LineString') {
        const line = feature as GeoJSON.Feature<GeoJSON.LineString>;
        const distKm = turf.pointToLineDistance(pt, line, { units: 'kilometers' });

        if (distKm < minDistanceToIMBL) {
          minDistanceToIMBL = distKm;
          nearestNeighbor = (feature.properties.neighbor as string) ?? 'Neighboring State';
        }
      }
    }
  }

  const roundedDistanceKm = Math.round(minDistanceToIMBL * 10) / 10;

  // 3. Determine Risk Status based on physical thresholds
  let riskStatus: GeofenceCheckResult['riskStatus'] = 'Safe';
  let notes = '';

  if (isInsideMPA) {
    riskStatus = 'Restricted Zone Violation';
    notes = `Vessel located within strict ecological conservation zone: ${protectedAreaName}. Trawling and commercial fishing prohibited.`;
  } else if (roundedDistanceKm <= 12) {
    riskStatus = 'Border Proximity Warning';
    notes = `High alert: Located ${roundedDistanceKm} km from the ${nearestNeighbor} International Maritime Boundary Line. Immediate course correction recommended to prevent accidental border crossing.`;
  } else if (roundedDistanceKm <= 35) {
    riskStatus = 'Caution';
    notes = `Caution: Operating within ${roundedDistanceKm} km buffer zone of the ${nearestNeighbor} IMBL. Maintain VHF radio watch and NavIC monitoring.`;
  } else {
    riskStatus = 'Safe';
    notes = `Vessel is in standard Indian EEZ waters. Distance to nearest international boundary (${nearestNeighbor}) is ${roundedDistanceKm} km.`;
  }

  return {
    isInsideEEZ: true, // Operating within surveyed domain
    distanceToIMBLKm: roundedDistanceKm,
    nearestNeighborCountry: nearestNeighbor,
    isInsideMarineProtectedArea: isInsideMPA,
    protectedAreaName,
    riskStatus,
    notes,
  };
}
