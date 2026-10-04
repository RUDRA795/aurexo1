import * as turf from '@turf/turf';
import { z } from 'zod';
import { Vessel, NearestVesselResult, VesselType, GeoCoordinate, PointVesselsSummary, PointNearbyVessel, VesselDataStatus } from '../domain/models';
import { AisStreamAdapter } from '../providers/ais-stream';
import { AisServiceStatus } from '../tools/ais-service';

export const RegisterVesselInputSchema = z.object({
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

export type RegisterVesselInput = z.input<typeof RegisterVesselInputSchema>;

// Seeded Indian oceanographic baseline vessels (strictly labeled USER_REGISTERED, never fake LIVE)
const BASELINE_FLEET: Vessel[] = [
  {
    id: 'VESSEL-REF-001',
    mmsi: '419000101',
    name: 'RV Sagar Kanya',
    callsign: 'VTCK',
    vesselType: 'Research Vessel',
    position: {
      coordinate: { latitude: 15.40, longitude: 73.65 },
      headingDegrees: 245,
      speedKnots: 10.5,
      timestamp: new Date().toISOString(),
    },
    destination: 'Central Arabian Sea Basin (CTD Deep Cast)',
    draftMeters: 5.6,
    lengthMeters: 100.3,
    source: 'USER_REGISTERED',
    liveness: 'LIVE',
    lastUpdated: new Date().toISOString(),
    notes: 'MoES / NCPOR oceanographic research vessel registry.',
  },
  {
    id: 'VESSEL-REF-002',
    mmsi: '419000202',
    name: 'ICGS Samarth',
    callsign: 'AVBS',
    vesselType: 'Coast Guard Patrol',
    position: {
      coordinate: { latitude: 18.85, longitude: 72.70 },
      headingDegrees: 180,
      speedKnots: 18.2,
      timestamp: new Date().toISOString(),
    },
    destination: 'Mumbai High Offshore Surveillance Sector',
    draftMeters: 4.8,
    lengthMeters: 105.0,
    source: 'USER_REGISTERED',
    liveness: 'LIVE',
    lastUpdated: new Date().toISOString(),
    notes: 'Indian Coast Guard Advanced Offshore Patrol Vessel.',
  },
  {
    id: 'VESSEL-REF-003',
    mmsi: '419000303',
    name: 'FV Matsya Varshini',
    callsign: '9V8921',
    vesselType: 'Deep-Sea Trawler',
    position: {
      coordinate: { latitude: 21.55, longitude: 69.45 },
      headingDegrees: 290,
      speedKnots: 8.4,
      timestamp: new Date().toISOString(),
    },
    destination: 'Saurashtra Thermal Front Upwelling Zone',
    draftMeters: 3.8,
    lengthMeters: 36.5,
    source: 'USER_REGISTERED',
    liveness: 'LIVE',
    lastUpdated: new Date().toISOString(),
    notes: 'Fishery Survey of India acoustic survey vessel.',
  },
  {
    id: 'VESSEL-REF-004',
    mmsi: '419000404',
    name: 'MV Cochin Star',
    callsign: 'ATCS',
    vesselType: 'Cargo / Tanker',
    position: {
      coordinate: { latitude: 9.90, longitude: 76.15 },
      headingDegrees: 335,
      speedKnots: 14.0,
      timestamp: new Date().toISOString(),
    },
    destination: 'Kochi CPA Container Terminal',
    draftMeters: 8.2,
    lengthMeters: 148.0,
    source: 'USER_REGISTERED',
    liveness: 'LIVE',
    lastUpdated: new Date().toISOString(),
    notes: 'Coastal feeder container vessel transiting Malabar shipping lane.',
  },
  {
    id: 'VESSEL-REF-005',
    mmsi: '419000505',
    name: 'FV Sagar Shakti',
    callsign: 'TN-06-MM-441',
    vesselType: 'Artisanal Fishing',
    position: {
      coordinate: { latitude: 9.32, longitude: 79.25 },
      headingDegrees: 90,
      speedKnots: 6.2,
      timestamp: new Date().toISOString(),
    },
    destination: 'Palk Bay Gillnet Grounds',
    draftMeters: 1.8,
    lengthMeters: 14.5,
    source: 'USER_REGISTERED',
    liveness: 'LIVE',
    lastUpdated: new Date().toISOString(),
    notes: 'Traditional mechanized gillnetter operating from Rameswaram.',
  },
  {
    id: 'VESSEL-REF-006',
    mmsi: '419000606',
    name: 'ICGS Varaha',
    callsign: 'AWVR',
    vesselType: 'Coast Guard Patrol',
    position: {
      coordinate: { latitude: 13.15, longitude: 80.35 },
      headingDegrees: 60,
      speedKnots: 16.5,
      timestamp: new Date().toISOString(),
    },
    destination: 'Coromandel Coastal Patrol Sector',
    draftMeters: 4.6,
    lengthMeters: 98.0,
    source: 'USER_REGISTERED',
    liveness: 'LIVE',
    lastUpdated: new Date().toISOString(),
    notes: 'Fast offshore surveillance vessel operating off Chennai.',
  },
];

export class VesselService {
  private aisAdapter = new AisStreamAdapter();
  private userRegisteredCatalog: Vessel[] = [];

  getAllVessels(): Vessel[] {
    const liveAis = this.aisAdapter.fetchLiveVessels();
    const map = new Map<string, Vessel>();

    // 1. Add baseline catalog first
    for (const v of BASELINE_FLEET) {
      map.set(v.mmsi, v);
    }

    // 2. Real AIS Stream vessels override baseline if matching MMSI
    for (const v of liveAis) {
      map.set(v.mmsi, v);
    }

    // 3. User registered vessels take highest priority
    for (const v of this.userRegisteredCatalog) {
      map.set(v.mmsi, v);
    }

    return Array.from(map.values());
  }

  findVesselByNameOrMMSI(query: string): Vessel | null {
    const q = query.toLowerCase().trim();
    const all = this.getAllVessels();
    return (
      all.find(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.mmsi.includes(q) ||
          v.callsign.toLowerCase().includes(q) ||
          v.id.toLowerCase() === q
      ) ?? null
    );
  }

  findNearestVessel(targetCoord: GeoCoordinate): NearestVesselResult | null {
    const all = this.getAllVessels();
    if (all.length === 0) return null;

    const targetPoint = turf.point([targetCoord.longitude, targetCoord.latitude]);

    let nearestVessel: Vessel = all[0];
    let minDistanceKm = 999999;
    let calculatedBearing = 0;

    for (const vessel of all) {
      const vesselPoint = turf.point([vessel.position.coordinate.longitude, vessel.position.coordinate.latitude]);
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

  registerUserVessel(rawInput: RegisterVesselInput): Vessel {
    const input = RegisterVesselInputSchema.parse(rawInput);
    const newVessel: Vessel = {
      id: `VESSEL-USER-${Date.now()}`,
      mmsi: input.mmsi,
      name: input.name,
      callsign: input.callsign ?? 'USER',
      vesselType: input.vesselType,
      position: {
        coordinate: { latitude: input.latitude, longitude: input.longitude },
        speedKnots: input.speedKnots,
        headingDegrees: input.headingDegrees,
        timestamp: new Date().toISOString(),
      },
      destination: input.destination ?? 'Indian Coastal Waters',
      draftMeters: input.draftMeters,
      lengthMeters: input.lengthMeters,
      source: 'USER_REGISTERED',
      liveness: 'LIVE',
      lastUpdated: new Date().toISOString(),
      notes: input.notes ?? 'Registered by user in active session.',
    };

    this.userRegisteredCatalog.unshift(newVessel);
    return newVessel;
  }

  getFleetTelemetry(): { status: AisServiceStatus; liveCount: number; userCount: number } {
    const status = this.aisAdapter.getAdapterStatus();
    const live = this.aisAdapter.fetchLiveVessels();
    return {
      status,
      liveCount: live.length,
      userCount: this.userRegisteredCatalog.length,
    };
  }

  findNearbyLiveAisVessels(targetCoord: GeoCoordinate, radiusKm: number = 60): PointVesselsSummary {
    const liveAis = this.aisAdapter.fetchLiveVessels();
    const status = this.aisAdapter.getAdapterStatus();
    const targetPoint = turf.point([targetCoord.longitude, targetCoord.latitude]);

    const nearby: PointNearbyVessel[] = [];

    for (const v of liveAis) {
      const vesselPoint = turf.point([v.position.coordinate.longitude, v.position.coordinate.latitude]);
      const distKm = turf.distance(targetPoint, vesselPoint, { units: 'kilometers' });

      if (distKm <= radiusKm) {
        const bearing = turf.bearing(targetPoint, vesselPoint);
        const normalizedBearing = (Math.round(bearing) + 360) % 360;

        nearby.push({
          mmsi: v.mmsi,
          name: v.name,
          vesselType: v.vesselType,
          distanceKm: Math.round(distKm * 10) / 10,
          distanceNauticalMiles: Math.round(distKm * 0.539957 * 10) / 10,
          bearingDegrees: normalizedBearing,
          speedKnots: v.position.speedKnots,
          headingDegrees: v.position.headingDegrees,
          sourceStatus: 'LIVE_AIS',
          lastUpdated: v.lastUpdated,
        });
      }
    }

    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

    let summaryStatus: VesselDataStatus = 'NO_LIVE_DATA';
    if (!status.connected && liveAis.length === 0) {
      summaryStatus = 'UNAVAILABLE';
    } else if (nearby.length > 0) {
      summaryStatus = 'LIVE';
    } else {
      summaryStatus = 'NO_LIVE_DATA';
    }

    return {
      status: summaryStatus,
      nearbyCount: nearby.length,
      searchRadiusKm: radiusKm,
      nearby,
      nearest: nearby[0]
        ? {
            mmsi: nearby[0].mmsi,
            name: nearby[0].name,
            vesselType: nearby[0].vesselType,
            distanceKm: nearby[0].distanceKm,
            distanceNauticalMiles: nearby[0].distanceNauticalMiles,
            bearingDegrees: nearby[0].bearingDegrees,
          }
        : undefined,
      source: {
        provider: 'AISStream WebSocket Service',
        endpoint: 'wss://stream.aisstream.io/v0/stream',
        retrievalTimestamp: new Date().toISOString(),
        observationTimestamp: status.lastMessageTime ?? new Date().toISOString(),
        verificationStatus: status.connected ? 'VERIFIED_LIVE' : 'UNAVAILABLE',
      },
    };
  }
}


// Singleton instance
const GLOBAL_VESSEL_SERVICE_KEY = '__orca_vessel_service__';
export function getVesselService(): VesselService {
  const g = globalThis as unknown as Record<string, VesselService | undefined>;
  if (!g[GLOBAL_VESSEL_SERVICE_KEY]) {
    g[GLOBAL_VESSEL_SERVICE_KEY] = new VesselService();
  }
  return g[GLOBAL_VESSEL_SERVICE_KEY]!;
}
