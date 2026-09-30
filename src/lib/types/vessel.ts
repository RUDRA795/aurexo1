import { GeoCoordinate } from './domain';

export type VesselType =
  | 'Artisanal Fishing'
  | 'Deep-Sea Trawler'
  | 'Research Vessel'
  | 'Coast Guard Patrol'
  | 'Cargo / Tanker';

export type VesselSourceStatus = 'LIVE_AIS' | 'USER_REGISTERED' | 'STALE' | 'UNAVAILABLE' | 'SIMULATED_TEST';

export interface MarineVessel {
  id: string;
  mmsi: string;
  name: string;
  callsign: string;
  vesselType: VesselType;
  coordinates: GeoCoordinate;
  headingDegrees: number;
  speedKnots: number;
  destination: string;
  draftMeters: number;
  lengthMeters: number;
  lastUpdated: string;
  sourceStatus: VesselSourceStatus;
  notes?: string;
}

export interface NearestVesselResult {
  vessel: MarineVessel;
  distanceKm: number;
  distanceNauticalMiles: number;
  bearingDegrees: number;
}
