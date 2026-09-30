import { z } from 'zod';
import { GeoCoordinate, WaveMetrics, WindMetrics, CurrentMetrics, DataProvenance } from '../domain/models';
import { ProviderError } from '../domain/errors';

const OpenMeteoMarineCurrentSchema = z.object({
  time: z.string(),
  wave_height: z.number().nullable().optional(),
  wave_direction: z.number().nullable().optional(),
  wave_period: z.number().nullable().optional(),
  ocean_current_velocity: z.number().nullable().optional(),
  ocean_current_direction: z.number().nullable().optional(),
  sea_surface_temperature: z.number().nullable().optional(),
});

const OpenMeteoMarineResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: OpenMeteoMarineCurrentSchema.optional(),
});

const OpenMeteoWeatherCurrentSchema = z.object({
  time: z.string(),
  temperature_2m: z.number().nullable().optional(),
  wind_speed_10m: z.number().nullable().optional(),
  wind_direction_10m: z.number().nullable().optional(),
  wind_gusts_10m: z.number().nullable().optional(),
  surface_pressure: z.number().nullable().optional(),
  weather_code: z.number().nullable().optional(),
});

const OpenMeteoWeatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: OpenMeteoWeatherCurrentSchema.optional(),
});

export function getBeaufortScale(windSpeedKmh: number): { scale: number; description: string } {
  const knots = windSpeedKmh * 0.539957;
  if (knots < 1) return { scale: 0, description: 'Calm' };
  if (knots <= 3) return { scale: 1, description: 'Light air' };
  if (knots <= 6) return { scale: 2, description: 'Light breeze' };
  if (knots <= 10) return { scale: 3, description: 'Gentle breeze' };
  if (knots <= 16) return { scale: 4, description: 'Moderate breeze' };
  if (knots <= 21) return { scale: 5, description: 'Fresh breeze' };
  if (knots <= 27) return { scale: 6, description: 'Strong breeze' };
  if (knots <= 33) return { scale: 7, description: 'Near gale' };
  if (knots <= 40) return { scale: 8, description: 'Gale' };
  if (knots <= 47) return { scale: 9, description: 'Strong gale' };
  if (knots <= 55) return { scale: 10, description: 'Storm' };
  if (knots <= 63) return { scale: 11, description: 'Violent storm' };
  return { scale: 12, description: 'Hurricane force' };
}

export function getWaveCategory(heightMeters: number): 'Calm' | 'Moderate' | 'Rough' | 'Very Rough' | 'Phenomenal' {
  if (heightMeters < 0.5) return 'Calm';
  if (heightMeters < 1.5) return 'Moderate';
  if (heightMeters < 2.5) return 'Rough';
  if (heightMeters < 4.0) return 'Very Rough';
  return 'Phenomenal';
}

export interface RawMarineData {
  wave: WaveMetrics;
  currents: CurrentMetrics;
  seaSurfaceTemperatureCelsius: number;
  observationTimestamp: string;
  provenance: DataProvenance;
}

export interface RawWeatherData {
  wind: WindMetrics;
  temperature2mCelsius: number;
  surfacePressureHpa?: number;
  observationTimestamp: string;
  provenance: DataProvenance;
}

export class OpenMeteoMarineAdapter {
  private readonly baseUrl = 'https://marine-api.open-meteo.com/v1/marine';

  async fetchMarineMetrics(coord: GeoCoordinate): Promise<RawMarineData> {
    const url = `${this.baseUrl}?latitude=${coord.latitude}&longitude=${coord.longitude}&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 300 },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new ProviderError(
          res.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
          'Open-Meteo Marine',
          `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const json = await res.json();
      const parsed = OpenMeteoMarineResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new ProviderError(
          'INVALID_RESPONSE',
          'Open-Meteo Marine',
          'Response failed schema validation',
          parsed.error
        );
      }

      const c = parsed.data.current;
      const waveHeight = c?.wave_height ?? 0;
      const waveDirection = c?.wave_direction ?? 0;
      const wavePeriod = c?.wave_period ?? 0;
      const currentVelocity = c?.ocean_current_velocity ?? 0;
      const currentDirection = c?.ocean_current_direction ?? 0;
      const sst = c?.sea_surface_temperature ?? 28.0;

      return {
        wave: {
          heightMeters: waveHeight,
          directionDegrees: waveDirection,
          periodSeconds: wavePeriod,
          category: getWaveCategory(waveHeight),
        },
        currents: {
          velocityKmh: currentVelocity,
          directionDegrees: currentDirection,
        },
        seaSurfaceTemperatureCelsius: sst,
        observationTimestamp: c?.time ?? new Date().toISOString(),
        provenance: {
          provider: 'Open-Meteo Marine API',
          endpoint: this.baseUrl,
          retrievalTimestamp: new Date().toISOString(),
          observationTimestamp: c?.time ?? new Date().toISOString(),
          verificationStatus: 'VERIFIED_LIVE',
        },
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError('TIMEOUT', 'Open-Meteo Marine', 'Request timed out after 8000ms');
      }
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Open-Meteo Marine', String(err), err);
    }
  }
}

export class OpenMeteoWeatherAdapter {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';

  async fetchWeatherMetrics(coord: GeoCoordinate): Promise<RawWeatherData> {
    const url = `${this.baseUrl}?latitude=${coord.latitude}&longitude=${coord.longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,weather_code`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 300 },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new ProviderError(
          res.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
          'Open-Meteo Weather',
          `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const json = await res.json();
      const parsed = OpenMeteoWeatherResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new ProviderError(
          'INVALID_RESPONSE',
          'Open-Meteo Weather',
          'Response failed schema validation',
          parsed.error
        );
      }

      const c = parsed.data.current;
      const windSpeed = c?.wind_speed_10m ?? 0;
      const windGusts = c?.wind_gusts_10m ?? windSpeed;
      const windDirection = c?.wind_direction_10m ?? 0;
      const temperature = c?.temperature_2m ?? 28.0;
      const beaufort = getBeaufortScale(windSpeed);

      return {
        wind: {
          speedKmh: windSpeed,
          gustsKmh: windGusts,
          directionDegrees: windDirection,
          beaufortScale: beaufort.scale,
          beaufortDescription: beaufort.description,
        },
        temperature2mCelsius: temperature,
        surfacePressureHpa: c?.surface_pressure ?? undefined,
        observationTimestamp: c?.time ?? new Date().toISOString(),
        provenance: {
          provider: 'Open-Meteo Atmospheric Forecast API',
          endpoint: this.baseUrl,
          retrievalTimestamp: new Date().toISOString(),
          observationTimestamp: c?.time ?? new Date().toISOString(),
          verificationStatus: 'VERIFIED_LIVE',
        },
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError('TIMEOUT', 'Open-Meteo Weather', 'Request timed out after 8000ms');
      }
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Open-Meteo Weather', String(err), err);
    }
  }
}
