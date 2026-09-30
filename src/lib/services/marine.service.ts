import { GeoCoordinate, MarineObservation } from '../domain/models';
import { OpenMeteoMarineAdapter, OpenMeteoWeatherAdapter } from '../providers/open-meteo';

interface CacheEntry {
  data: MarineObservation;
  expiresAt: number;
}

export class MarineService {
  private marineAdapter = new OpenMeteoMarineAdapter();
  private weatherAdapter = new OpenMeteoWeatherAdapter();
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minute TTL

  private getCacheKey(coord: GeoCoordinate): string {
    // Quantize to ~1.1km grid to optimize cache hits for near-identical coordinates
    const lat = coord.latitude.toFixed(2);
    const lon = coord.longitude.toFixed(2);
    return `${lat}_${lon}`;
  }

  async getMarineObservation(
    coordinate: GeoCoordinate,
    locationName: string = 'Offshore Point'
  ): Promise<MarineObservation> {
    const key = this.getCacheKey(coordinate);
    const now = Date.now();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return {
        ...cached.data,
        locationName, // update to current context
      };
    }

    // Parallel fetch from verified live providers
    const [marineData, weatherData] = await Promise.all([
      this.marineAdapter.fetchMarineMetrics(coordinate),
      this.weatherAdapter.fetchWeatherMetrics(coordinate),
    ]);

    const isSafeForSmallCraft =
      marineData.wave.heightMeters < 2.0 &&
      weatherData.wind.speedKmh < 35 &&
      weatherData.wind.beaufortScale <= 5;

    let advisoryText = '';
    if (!isSafeForSmallCraft) {
      advisoryText = `Caution: Wave height (${marineData.wave.heightMeters.toFixed(1)}m) or wind speed (${weatherData.wind.speedKmh.toFixed(1)} km/h, ${weatherData.wind.beaufortDescription}) exceed safe operational thresholds for small craft. Fishermen are advised not to venture into deep sea.`;
    } else {
      advisoryText = `Favorable conditions: Wave height is ${marineData.wave.heightMeters.toFixed(1)}m (${marineData.wave.category}) with ${weatherData.wind.beaufortDescription} (${weatherData.wind.speedKmh.toFixed(1)} km/h). Safe for coastal fishing operations.`;
    }

    const observation: MarineObservation = {
      id: `OBS-${coordinate.latitude.toFixed(3)}-${coordinate.longitude.toFixed(3)}-${now}`,
      coordinate,
      coordinates: coordinate,
      locationName,
      retrievedAt: new Date().toISOString(),
      observationTime: marineData.observationTimestamp,
      source: 'Open-Meteo Marine & Atmospheric Reanalysis',
      sourceStatus: 'VERIFIED_LIVE',
      wave: marineData.wave,
      wind: weatherData.wind,
      currents: marineData.currents,
      seaSurfaceTemperatureCelsius: marineData.seaSurfaceTemperatureCelsius,
      isSafeForSmallCraft,
      advisoryText,
      provenance: {
        provider: 'Open-Meteo Marine & Atmospheric Reanalysis',
        endpoint: 'https://marine-api.open-meteo.com',
        retrievalTimestamp: new Date().toISOString(),
        observationTimestamp: marineData.observationTimestamp,
        verificationStatus: 'VERIFIED_LIVE',
      },
    };

    this.cache.set(key, { data: observation, expiresAt: now + this.ttlMs });
    return observation;
  }
}

// Singleton instance
const GLOBAL_MARINE_SERVICE_KEY = '__aurexo_marine_service__';
export function getMarineService(): MarineService {
  const g = globalThis as unknown as Record<string, MarineService | undefined>;
  if (!g[GLOBAL_MARINE_SERVICE_KEY]) {
    g[GLOBAL_MARINE_SERVICE_KEY] = new MarineService();
  }
  return g[GLOBAL_MARINE_SERVICE_KEY]!;
}
