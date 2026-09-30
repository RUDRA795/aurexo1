import { Vessel, VesselType } from '../domain/models';
import { getRealTimeAisVessels, getRealTimeAisStatus, AisServiceStatus } from '../tools/ais-service';

export class AisStreamAdapter {
  fetchLiveVessels(): Vessel[] {
    const rawVessels = getRealTimeAisVessels();
    return rawVessels.map((rv) => ({
      id: rv.id,
      mmsi: rv.mmsi,
      name: rv.name,
      callsign: rv.callsign,
      vesselType: rv.vesselType as VesselType,
      position: {
        coordinate: rv.coordinates,
        speedKnots: rv.speedKnots,
        headingDegrees: rv.headingDegrees,
        timestamp: rv.lastUpdated,
      },
      destination: rv.destination ?? 'Indian Coastal Waters',
      draftMeters: rv.draftMeters,
      lengthMeters: rv.lengthMeters,
      source: 'AIS',
      liveness: rv.sourceStatus === 'STALE' ? 'STALE' : 'LIVE',
      lastUpdated: rv.lastUpdated,
      notes: rv.notes,
    }));
  }

  getAdapterStatus(): AisServiceStatus {
    return getRealTimeAisStatus();
  }
}
