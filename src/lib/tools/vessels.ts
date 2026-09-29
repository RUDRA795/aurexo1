import * as turf from '@turf/turf';
import { z } from 'zod';
import { MarineVessel, NearestVesselResult, VesselType } from '../types/vessel';
import { GeoCoordinate } from '../types/domain';

// Pre-seeded fleet operating in Indian Exclusive Economic Zone
const INITIAL_FLEET: MarineVessel[] = [
  {
    id: 'VESSEL-001',
    mmsi: '419000101',
    name: 'RV Sagar Kanya',
    callsign: 'VTCK',
    vesselType: 'Research Vessel',
    coordinates: { latitude: 15.40, longitude: 73.65 },
    headingDegrees: 245,
    speedKnots: 10.5,
    destination: 'Central Arabian Sea Basin (CTD Deep Cast)',
    draftMeters: 5.6,
    lengthMeters: 100.3,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'LIVE_AIS',
    notes: 'MoES / National Centre for Polar and Ocean Research oceanographic expedition vessel.',
  },
  {
    id: 'VESSEL-002',
    mmsi: '419000202',
    name: 'ICGS Samarth',
    callsign: 'AVBS',
    vesselType: 'Coast Guard Patrol',
    coordinates: { latitude: 18.85, longitude: 72.70 },
    headingDegrees: 180,
    speedKnots: 18.2,
    destination: 'Mumbai High Offshore Surveillance Sector',
    draftMeters: 4.8,
    lengthMeters: 105.0,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'LIVE_AIS',
    notes: 'Indian Coast Guard Advanced Offshore Patrol Vessel patrolling western maritime frontier.',
  },
  {
    id: 'VESSEL-003',
    mmsi: '419000303',
    name: 'FV Matsya Varshini',
    callsign: '9V8921',
    vesselType: 'Deep-Sea Trawler',
    coordinates: { latitude: 21.55, longitude: 69.45 },
    headingDegrees: 290,
    speedKnots: 8.4,
    destination: 'Saurashtra Thermal Front Upwelling Zone',
    draftMeters: 3.8,
    lengthMeters: 36.5,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'LIVE_AIS',
    notes: 'Fishery Survey of India pelagic tuna exploratory and acoustic survey vessel.',
  },
  {
    id: 'VESSEL-004',
    mmsi: '419000404',
    name: 'MV Cochin Star',
    callsign: 'ATCS',
    vesselType: 'Cargo / Tanker',
    coordinates: { latitude: 9.90, longitude: 76.15 },
    headingDegrees: 335,
    speedKnots: 14.0,
    destination: 'Kochi CPA Container Terminal',
    draftMeters: 8.2,
    lengthMeters: 148.0,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'LIVE_AIS',
    notes: 'Coastal feeder container vessel transiting the Malabar coast shipping lane.',
  },
  {
    id: 'VESSEL-005',
    mmsi: '419000505',
    name: 'FV Sagar Shakti',
    callsign: 'TN-06-MM-441',
    vesselType: 'Artisanal Fishing',
    coordinates: { latitude: 9.32, longitude: 79.25 },
    headingDegrees: 90,
    speedKnots: 6.2,
    destination: 'Palk Bay Gillnet Grounds',
    draftMeters: 1.8,
    lengthMeters: 14.5,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'LIVE_AIS',
    notes: 'Traditional mechanized gillnetter operating from Rameswaram fishing harbour.',
  },
  {
    id: 'VESSEL-006',
    mmsi: '419000606',
    name: 'ICGS Varaha',
    callsign: 'AWVR',
    vesselType: 'Coast Guard Patrol',
    coordinates: { latitude: 13.15, longitude: 80.35 },
    headingDegrees: 60,
    speedKnots: 16.5,
    destination: 'Coromandel Coastal Patrol Sector',
    draftMeters: 4.6,
    lengthMeters: 98.0,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'LIVE_AIS',
    notes: 'Fast offshore surveillance vessel operating off Chennai.',
  },
];

// In-memory active vessel registry (thread-safe on Node runtime)
let activeVesselFleet: MarineVessel[] = [...INITIAL_FLEET];

export function getAllVessels(): MarineVessel[] {
  return [...activeVesselFleet];
}

export function findVesselByNameOrMMSI(query: string): MarineVessel | null {
  const q = query.toLowerCase().trim();
  return (
    activeVesselFleet.find(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.mmsi.includes(q) ||
        v.callsign.toLowerCase().includes(q) ||
        v.id.toLowerCase() === q
    ) ?? null
  );
}

/**
 * Finds the nearest vessel to a specified coordinate using Turf.js spatial distance.
 */
export function findNearestVessel(targetCoord: GeoCoordinate): NearestVesselResult | null {
  if (activeVesselFleet.length === 0) return null;

  const targetPoint = turf.point([targetCoord.longitude, targetCoord.latitude]);

  let nearestVessel: MarineVessel = activeVesselFleet[0];
  let minDistanceKm = 999999;
  let calculatedBearing = 0;

  for (const vessel of activeVesselFleet) {
    const vesselPoint = turf.point([vessel.coordinates.longitude, vessel.coordinates.latitude]);
    const distKm = turf.distance(targetPoint, vesselPoint, { units: 'kilometers' });

    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
      nearestVessel = vessel;
      calculatedBearing = turf.bearing(targetPoint, vesselPoint);
    }
  }

  const roundedKm = Math.round(minDistanceKm * 10) / 10;
  const roundedNM = Math.round((minDistanceKm * 0.539957) * 10) / 10;
  const normalizedBearing = (Math.round(calculatedBearing) + 360) % 360;

  return {
    vessel: nearestVessel,
    distanceKm: roundedKm,
    distanceNauticalMiles: roundedNM,
    bearingDegrees: normalizedBearing,
  };
}

export const RegisterVesselSchema = z.object({
  name: z.string().min(2),
  mmsi: z.string().min(7),
  callsign: z.string().optional().default('CUSTOM'),
  vesselType: z.enum([
    'Artisanal Fishing',
    'Deep-Sea Trawler',
    'Research Vessel',
    'Coast Guard Patrol',
    'Cargo / Tanker',
  ] as const),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKnots: z.number().min(0).max(100).default(0),
  headingDegrees: z.number().min(0).max(360).default(0),
  destination: z.string().optional().default('Indian Coastal Waters'),
  draftMeters: z.number().min(0).max(30).default(2.5),
  lengthMeters: z.number().min(1).max(500).default(20),
  notes: z.string().optional(),
});

export type RegisterVesselInput = z.input<typeof RegisterVesselSchema>;

export function registerUserVessel(rawInput: RegisterVesselInput): MarineVessel {
  const input = RegisterVesselSchema.parse(rawInput);
  const newVessel: MarineVessel = {
    id: `VESSEL-USER-${Date.now()}`,
    mmsi: input.mmsi,
    name: input.name,
    callsign: input.callsign ?? 'USER',
    vesselType: input.vesselType,
    coordinates: { latitude: input.latitude, longitude: input.longitude },
    headingDegrees: input.headingDegrees,
    speedKnots: input.speedKnots,
    destination: input.destination ?? 'Coastal Waters',
    draftMeters: input.draftMeters,
    lengthMeters: input.lengthMeters,
    lastUpdated: new Date().toISOString(),
    sourceStatus: 'USER_REGISTERED',
    notes: input.notes ?? 'Registered by user in active session.',
  };

  activeVesselFleet.unshift(newVessel);
  return newVessel;
}
