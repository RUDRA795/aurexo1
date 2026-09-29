import { INDIAN_MARITIME_REGIONS } from '../data/regions';
import { MaritimeRegion, RegionalMarineState } from '../types/regions';
import { GeoCoordinate } from '../types/domain';
import { fetchMarineConditions } from './marine-conditions';

export function getAllRegions(): MaritimeRegion[] {
  return INDIAN_MARITIME_REGIONS;
}

export function findRegionByName(query: string): MaritimeRegion | null {
  const norm = query.toLowerCase().trim();
  for (const reg of INDIAN_MARITIME_REGIONS) {
    const regId = reg.id.toLowerCase();
    const regName = reg.name.toLowerCase();
    const regState = reg.state.toLowerCase();

    // Check if query contains region name/state/id or vice-versa
    if (
      norm.includes(regId) ||
      norm.includes(regState) ||
      regId.includes(norm) ||
      regName.includes(norm) ||
      regState.includes(norm)
    ) {
      return reg;
    }

    // Check port names
    for (const port of reg.primaryPorts) {
      const portNorm = port.toLowerCase();
      // Match port keywords like "mumbai", "kochi", "kandla", "chennai", "paradip"
      const portKeywords = portNorm.replace(/[()]/g, '').split(' ');
      if (portKeywords.some((k) => k.length > 3 && norm.includes(k))) {
        return reg;
      }
    }
  }
  return null;
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

/**
 * Scans active regional marine states across all coastal sectors.
 * Uses real Open-Meteo observations for each regional center.
 */
export async function scanActiveRegionalWarnings(): Promise<RegionalMarineState[]> {
  const regionsToScan = INDIAN_MARITIME_REGIONS;

  const results: RegionalMarineState[] = [];

  await Promise.all(
    regionsToScan.map(async (reg) => {
      try {
        const obs = await fetchMarineConditions(reg.center, reg.name);
        const wave = obs.wave.heightMeters;
        const wind = obs.wind.speedKmh;
        const isRough = wave >= 2.0 || wind >= 35;
        let warningCount = 0;
        if (wave >= 2.5) warningCount++;
        if (wind >= 40) warningCount++;
        if (obs.wave.periodSeconds >= 14) warningCount++; // Kallakkadal swell signature

        let safetySummary = 'Favorable coastal sea conditions.';
        if (isRough) {
          safetySummary = `Rough sea state: Wave height ${wave.toFixed(1)}m, wind ${wind.toFixed(0)} km/h. Small craft advisory in effect.`;
        }

        results.push({
          regionId: reg.id,
          regionName: reg.name,
          sea: reg.sea,
          center: reg.center,
          activeWarningsCount: warningCount,
          isSeaRough: isRough,
          representativeObservation: {
            waveHeightMeters: wave,
            windSpeedKmh: wind,
            sstCelsius: obs.seaSurfaceTemperatureCelsius,
            sourceStatus: obs.sourceStatus,
            observationTime: obs.observationTime,
          },
          safetySummary,
        });
      } catch (err) {
        console.error(`Error scanning region ${reg.name}:`, err);
      }
    })
  );

  return results;
}
