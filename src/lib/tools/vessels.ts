import { MarineVessel, NearestVesselResult, VesselType } from '../types/vessel';
import { GeoCoordinate } from '../types/domain';
import { getVesselService, RegisterVesselInput, RegisterVesselInputSchema } from '../services/vessel.service';
import { AisServiceStatus } from './ais-service';
import { Vessel } from '../domain/models';

export { RegisterVesselInputSchema as RegisterVesselSchema };
export type { RegisterVesselInput };
export type { AisServiceStatus };

function toMarineVessel(v: Vessel): MarineVessel {
  return {
    id: v.id,
    mmsi: v.mmsi,
    name: v.name,
    callsign: v.callsign,
    vesselType: v.vesselType,
    coordinates: v.position.coordinate,
    headingDegrees: v.position.headingDegrees,
    speedKnots: v.position.speedKnots,
    destination: v.destination,
    draftMeters: v.draftMeters,
    lengthMeters: v.lengthMeters,
    lastUpdated: v.lastUpdated,
    sourceStatus: v.source === 'AIS' ? (v.liveness === 'STALE' ? 'STALE' : 'LIVE_AIS') : 'USER_REGISTERED',
    notes: v.notes,
  };
}

export function getAllVessels(): MarineVessel[] {
  const service = getVesselService();
  return service.getAllVessels().map(toMarineVessel);
}

export function getFleetAisTelemetry(): { status: AisServiceStatus; liveCount: number; userCount: number } {
  const service = getVesselService();
  return service.getFleetTelemetry();
}

export function findVesselByNameOrMMSI(query: string): MarineVessel | null {
  const service = getVesselService();
  const found = service.findVesselByNameOrMMSI(query);
  return found ? toMarineVessel(found) : null;
}

export function findNearestVessel(targetCoord: GeoCoordinate): NearestVesselResult | null {
  const service = getVesselService();
  const nearest = service.findNearestVessel(targetCoord);
  if (!nearest) return null;

  return {
    vessel: toMarineVessel(nearest.vessel),
    distanceKm: nearest.distanceKm,
    distanceNauticalMiles: nearest.distanceNauticalMiles,
    bearingDegrees: nearest.bearingDegrees,
  };
}

export function registerUserVessel(rawInput: RegisterVesselInput): MarineVessel {
  const service = getVesselService();
  const created = service.registerUserVessel(rawInput);
  return toMarineVessel(created);
}
