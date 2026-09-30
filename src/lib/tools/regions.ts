import { MaritimeRegion, RegionalMarineState } from '../types/regions';
import { GeoCoordinate } from '../types/domain';
import { getRegionService } from '../services/region.service';
import { INDIAN_MARITIME_REGIONS } from '../data/regions';

/**
 * Delegating tool facade for RegionService.
 * Ensures backward compatibility while routing all calls through the canonical RegionService.
 */
export function getAllRegions(): MaritimeRegion[] {
  return getRegionService().getAllRegions() as MaritimeRegion[];
}

export function findRegionByName(query: string): MaritimeRegion | null {
  return getRegionService().findRegionByName(query) as MaritimeRegion | null;
}

export function findRegionByCoordinate(coord: GeoCoordinate): MaritimeRegion | null {
  for (const reg of INDIAN_MARITIME_REGIONS) {
    const { minLat, maxLat, minLon, maxLon } = reg.boundingBox;
    if (
      coord.latitude >= minLat &&
      coord.latitude <= maxLat &&
      coord.longitude >= minLon &&
      coord.longitude <= maxLon
    ) {
      return reg;
    }
  }
  return null;
}

export async function scanActiveRegionalWarnings(): Promise<RegionalMarineState[]> {
  const service = getRegionService();
  const states = await service.scanActiveWarnings();

  return states.map((s) => {
    let warningCount = s.activeAlerts.length;
    if (s.observation.wave.periodSeconds >= 14) warningCount++;

    let safetySummary = 'Favorable coastal sea conditions.';
    if (s.isSeaRough) {
      safetySummary = `Rough sea state: Wave height ${s.observation.wave.heightMeters.toFixed(1)}m, wind ${s.observation.wind.speedKmh.toFixed(0)} km/h. Small craft advisory in effect.`;
    }

    return {
      regionId: s.region.id,
      regionName: s.region.name,
      sea: s.region.sea,
      center: s.region.center,
      activeWarningsCount: warningCount,
      isSeaRough: s.isSeaRough,
      representativeObservation: {
        waveHeightMeters: s.observation.wave.heightMeters,
        windSpeedKmh: s.observation.wind.speedKmh,
        sstCelsius: s.observation.seaSurfaceTemperatureCelsius,
        sourceStatus: s.observation.provenance.verificationStatus,
        observationTime: s.observation.provenance.observationTimestamp,
      },
      safetySummary,
    };
  });
}
