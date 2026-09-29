import { z } from 'zod';
import { fetchMarineConditions } from './marine-conditions';
import { checkGeofence } from '../geo/boundaries';
import { computeSafePassage } from '../geo/routes';
import { getPFZAdvisories } from './incois-pfz';
import { getMarineHazards } from './marine-hazards';
import { SatelliteLayerId, GeoCoordinate } from '../types/domain';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

export const TOOLS: Record<string, ToolDefinition> = {
  get_marine_conditions: {
    name: 'get_marine_conditions',
    description:
      'Retrieves verified live physical oceanographic and meteorological observations (wave height, wave direction, currents, sea surface temperature, wind speed, Beaufort scale, small-craft safety).',
    parameters: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      locationName: z.string().optional(),
    }),
    execute: async ({ latitude, longitude, locationName }: { latitude: number; longitude: number; locationName?: string }) => {
      const coord: GeoCoordinate = { latitude, longitude };
      return await fetchMarineConditions(coord, locationName ?? 'Target Coordinate');
    },
  },

  check_geofence_and_boundaries: {
    name: 'check_geofence_and_boundaries',
    description:
      'Deterministically checks proximity to the International Maritime Boundary Line (IMBL - Pakistan, Sri Lanka) and whether a coordinate falls inside strict Marine Protected Areas (MPAs).',
    parameters: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    execute: async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      return checkGeofence({ latitude, longitude });
    },
  },

  get_pfz_advisories: {
    name: 'get_pfz_advisories',
    description:
      'Retrieves coastal sector Potential Fishing Zones (PFZ) and target pelagic species information based on INCOIS oceanographic guidelines.',
    parameters: z.object({
      region: z.string().optional().default('all'),
    }),
    execute: async ({ region }: { region?: string }) => {
      return await getPFZAdvisories(region ?? 'all');
    },
  },

  get_marine_hazards: {
    name: 'get_marine_hazards',
    description:
      'Evaluates active oceanographic and atmospheric hazards (high waves, squall, storms) for a maritime location.',
    parameters: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      regionName: z.string().optional().default('Coastal Sector'),
    }),
    execute: async ({ latitude, longitude, regionName }: { latitude: number; longitude: number; regionName?: string }) => {
      return await getMarineHazards({ latitude, longitude }, regionName ?? 'Coastal Sector');
    },
  },

  compute_safe_passage: {
    name: 'compute_safe_passage',
    description:
      'Calculates safe passage waypoints between origin and destination coordinates, computing total distance, estimated travel duration, and checking intermediate boundary risks.',
    parameters: z.object({
      originLat: z.number().min(-90).max(90),
      originLon: z.number().min(-180).max(180),
      destLat: z.number().min(-90).max(90),
      destLon: z.number().min(-180).max(180),
      vesselSpeedKmh: z.number().optional().default(22),
    }),
    execute: async ({
      originLat,
      originLon,
      destLat,
      destLon,
      vesselSpeedKmh,
    }: {
      originLat: number;
      originLon: number;
      destLat: number;
      destLon: number;
      vesselSpeedKmh?: number;
    }) => {
      return computeSafePassage(
        { latitude: originLat, longitude: originLon },
        { latitude: destLat, longitude: destLon },
        vesselSpeedKmh ?? 22
      );
    },
  },

  show_satellite_layer: {
    name: 'show_satellite_layer',
    description:
      'Selects a satellite observation layer to display on the map interface: "sst" (Sea Surface Temperature), "chlorophyll" (Ocean color / Chlorophyll-a), "truecolor" (MODIS TrueColor), or "none" (satellite basemap).',
    parameters: z.object({
      layerId: z.enum(['none', 'truecolor', 'sst', 'chlorophyll']),
    }),
    execute: async ({ layerId }: { layerId: SatelliteLayerId }) => {
      return { activeLayer: layerId, message: `Activated ${layerId} satellite layer.` };
    },
  },
};
