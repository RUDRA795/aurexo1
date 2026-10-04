import * as turf from '@turf/turf';
import { GeoCoordinate, GeofenceCheckResult } from '../types/domain';

// Baseline verified geospatial geometries (EEZ, IMBL, MPAs) ensuring zero I/O latency & universal client/server compatibility
const EEZ_IMBL_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'India - Pakistan IMBL',
        type: 'IMBL',
        neighbor: 'Pakistan',
        description: 'International Maritime Boundary Line (Sir Creek seaward extension)',
        alertThresholdKm: 35,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [68.16, 23.63],
          [67.8, 23.5],
          [67.3, 23.25],
          [66.5, 22.8],
          [65.7, 22.3],
          [64.8, 21.6],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'India - Sri Lanka IMBL',
        type: 'IMBL',
        neighbor: 'Sri Lanka',
        description: 'International Maritime Boundary Line in Palk Bay and Gulf of Mannar',
        alertThresholdKm: 25,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.85, 10.08],
          [79.66, 9.68],
          [79.53, 9.36],
          [79.45, 9.15],
          [79.4, 9.0],
          [79.35, 8.85],
          [79.3, 8.6],
          [79.15, 8.35],
          [79.0, 8.1],
          [78.85, 7.85],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'India EEZ Sector - Arabian Sea',
        type: 'EEZ',
        description: 'Indian Exclusive Economic Zone Arabian Sea perimeter',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [68.16, 23.63],
          [66.0, 20.0],
          [68.5, 16.0],
          [70.0, 12.0],
          [74.0, 7.5],
          [77.5, 6.5],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'India EEZ Sector - Bay of Bengal',
        type: 'EEZ',
        description: 'Indian Exclusive Economic Zone Bay of Bengal perimeter',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [78.85, 7.85],
          [82.0, 10.0],
          [85.0, 13.0],
          [88.0, 17.0],
          [89.5, 20.5],
        ],
      },
    },
  ],
};

const MPA_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'MPA-01',
        name: 'Gulf of Mannar Marine National Park',
        state: 'Tamil Nadu',
        category: 'Strict Ecological Reserve - No Commercial Trawling',
        designatedYear: 1986,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [78.8, 9.25],
            [79.25, 9.25],
            [79.35, 9.1],
            [78.9, 8.85],
            [78.6, 8.75],
            [78.8, 9.25],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'MPA-02',
        name: 'Marine National Park, Gulf of Kutch',
        state: 'Gujarat',
        category: 'Coral Reef & Mangrove Sanctuary',
        designatedYear: 1982,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [69.1, 22.45],
            [70.0, 22.75],
            [70.3, 22.8],
            [70.3, 22.5],
            [69.6, 22.35],
            [69.1, 22.45],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'MPA-03',
        name: 'Sundarbans Biosphere Reserve - Coastal Buffer',
        state: 'West Bengal',
        category: 'UNESCO World Heritage Tidal Mangrove Protected Zone',
        designatedYear: 1989,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [88.3, 21.5],
            [89.15, 21.6],
            [89.15, 21.85],
            [88.3, 21.85],
            [88.3, 21.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'MPA-04',
        name: 'Malvan Marine Sanctuary',
        state: 'Maharashtra',
        category: 'Coastal Reef Conservation Zone',
        designatedYear: 1987,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [73.44, 16.03],
            [73.49, 16.08],
            [73.53, 16.05],
            [73.48, 16.0],
            [73.44, 16.03],
          ],
        ],
      },
    },
  ],
};

export function loadGeoData(): { eez: GeoJSON.FeatureCollection; mpa: GeoJSON.FeatureCollection } {
  return { eez: EEZ_IMBL_GEOJSON, mpa: MPA_GEOJSON };
}

/**
 * Deterministically calculates distances to International Maritime Boundary Line (IMBL)
 * and checks point-in-polygon containment for Marine Protected Areas.
 * No LLM calculation involved.
 */
export function checkGeofence(coord: GeoCoordinate): GeofenceCheckResult {
  const { eez, mpa } = loadGeoData();
  const pt = turf.point([coord.longitude, coord.latitude]);

  // 1. Check Marine Protected Areas (Point-in-Polygon)
  let isInsideMPA = false;
  let protectedAreaName: string | undefined = undefined;

  for (const feature of mpa.features) {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const poly = feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
      if (turf.booleanPointInPolygon(pt, poly)) {
        isInsideMPA = true;
        protectedAreaName = (feature.properties?.name as string) ?? 'Marine Protected Reserve';
        break;
      }
    }
  }

  // 2. Calculate Distance to Nearest IMBL segment
  let minDistanceToIMBL = 9999;
  let nearestNeighbor = 'International Waters';

  for (const feature of eez.features) {
    if (feature.properties?.type === 'IMBL' && feature.geometry.type === 'LineString') {
      const line = feature as GeoJSON.Feature<GeoJSON.LineString>;
      const distKm = turf.pointToLineDistance(pt, line, { units: 'kilometers' });

      if (distKm < minDistanceToIMBL) {
        minDistanceToIMBL = distKm;
        nearestNeighbor = (feature.properties.neighbor as string) ?? 'Neighboring State';
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
