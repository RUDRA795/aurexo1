import * as turf from '@turf/turf';
import { GeoCoordinate, RegionMetadata, RegionalState } from '../domain/models';
import { INDIAN_MARITIME_REGIONS } from '../data/regions';
import { getMarineService } from './marine.service';
import { getAlertService } from './alert.service';

export class RegionService {
  private marineService = getMarineService();
  private alertService = getAlertService();

  getAllRegions(): RegionMetadata[] {
    return INDIAN_MARITIME_REGIONS;
  }

  findNearestRegion(coord: GeoCoordinate): { region: RegionMetadata; distanceKm: number } {
    const pt = turf.point([coord.longitude, coord.latitude]);
    let nearest = INDIAN_MARITIME_REGIONS[0];
    let minDistance = 999999;

    for (const r of INDIAN_MARITIME_REGIONS) {
      const rPt = turf.point([r.center.longitude, r.center.latitude]);
      const dist = turf.distance(pt, rPt, { units: 'kilometers' });
      if (dist < minDistance) {
        minDistance = dist;
        nearest = r;
      }
    }

    return {
      region: nearest,
      distanceKm: Math.round(minDistance * 10) / 10,
    };
  }


  findRegionByName(nameOrAlias: string): RegionMetadata | null {
    const norm = nameOrAlias.toLowerCase().trim();
    for (const reg of INDIAN_MARITIME_REGIONS) {
      const regId = reg.id.toLowerCase();
      const regName = reg.name.toLowerCase();
      const regState = reg.state.toLowerCase();

      if (
        norm.includes(regId) ||
        norm.includes(regState) ||
        regId.includes(norm) ||
        regName.includes(norm) ||
        regState.includes(norm)
      ) {
        return reg;
      }

      for (const port of reg.primaryPorts) {
        const portNorm = port.toLowerCase();
        const portKeywords = portNorm.replace(/[()]/g, '').split(' ');
        if (portKeywords.some((k) => k.length > 3 && norm.includes(k))) {
          return reg;
        }
      }
    }
    return null;
  }

  async scanActiveWarnings(): Promise<RegionalState[]> {
    return Promise.all(
      INDIAN_MARITIME_REGIONS.map(async (region) => {
        const observation = await this.marineService.getMarineObservation(region.center, region.name);
        const activeAlerts = await this.alertService.evaluateMarineAlerts(region.center, region.name, observation);
        const isSeaRough = observation.wave.heightMeters >= 2.0 || observation.wind.speedKmh >= 35;

        return {
          region,
          observation,
          activeAlerts,
          isSeaRough,
          evaluatedAt: new Date().toISOString(),
        };
      })
    );
  }
}

// Singleton instance
const GLOBAL_REGION_SERVICE_KEY = '__orca_region_service__';
export function getRegionService(): RegionService {
  const g = globalThis as unknown as Record<string, RegionService | undefined>;
  if (!g[GLOBAL_REGION_SERVICE_KEY]) {
    g[GLOBAL_REGION_SERVICE_KEY] = new RegionService();
  }
  return g[GLOBAL_REGION_SERVICE_KEY]!;
}
