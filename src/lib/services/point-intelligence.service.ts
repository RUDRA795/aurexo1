import {
  GeoCoordinate,
  PointIntelligence,
  PointWeatherMetrics,
  PointMarineMetrics,
  PointVesselsSummary,
  PointLocationContext,
  PointSpatialContext,
  SafetyAssessment,
  DataProvenance,
  MarineObservation,
} from '../domain/models';
import { OpenMeteoWeatherAdapter, OpenMeteoMarineAdapter, RawWeatherData, RawMarineData } from '../providers/open-meteo';
import { getMarineService, MarineService } from './marine.service';
import { getVesselService, VesselService } from './vessel.service';
import { getRegionService, RegionService } from './region.service';
import { getSafetyService, SafetyService } from './safety.service';
import { checkGeofence } from '../geo/boundaries';

interface CachedPointEntry {
  data: PointIntelligence;
  cachedAt: number;
}

export class PointIntelligenceService {
  private weatherAdapter = new OpenMeteoWeatherAdapter();
  private marineAdapter = new OpenMeteoMarineAdapter();
  private marineService: MarineService = getMarineService();
  private vesselService: VesselService = getVesselService();
  private regionService: RegionService = getRegionService();
  private safetyService: SafetyService = getSafetyService();

  private cache = new Map<string, CachedPointEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private quantizeCoordinate(coord: GeoCoordinate): string {
    // 0.01 degree ~ 1.1 km quantization
    const lat = Math.round(coord.latitude * 100) / 100;
    const lon = Math.round(coord.longitude * 100) / 100;
    return `${lat.toFixed(2)},${lon.toFixed(2)}`;
  }

  async getPointIntelligence(coord: GeoCoordinate): Promise<PointIntelligence> {
    const cacheKey = this.quantizeCoordinate(coord);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      return {
        ...cached.data,
        weather: {
          ...cached.data.weather,
          status: cached.data.weather.status === 'LIVE' ? 'CACHED' : cached.data.weather.status,
        },
        marine: {
          ...cached.data.marine,
          status: cached.data.marine.status === 'LIVE' ? 'CACHED' : cached.data.marine.status,
        },
      };
    }

    // 1. Spatial & Regional Context (local deterministic calculation)
    const { region: nearestRegion, distanceKm: distToRegionCenter } = this.regionService.findNearestRegion(coord);
    const geofence = checkGeofence(coord);

    const locationContext: PointLocationContext = {
      regionId: nearestRegion.id,
      regionName: nearestRegion.name,
      sea: nearestRegion.sea,
      state: nearestRegion.state,
      spatialContext: `${nearestRegion.name} (${nearestRegion.sea}) — approx. ${distToRegionCenter} km from regional anchor`,
    };

    const spatialContext: PointSpatialContext = {
      regionName: nearestRegion.name,
      isInsideEEZ: geofence.isInsideEEZ,
      distanceToIMBLKm: geofence.distanceToIMBLKm,
      nearestNeighborCountry: geofence.nearestNeighborCountry,
      isInsideMarineProtectedArea: geofence.isInsideMarineProtectedArea,
      protectedAreaName: geofence.protectedAreaName,
      riskStatus: geofence.riskStatus,
      notes: geofence.notes,
    };

    // 2. Fetch External Signals in parallel with individual error isolation
    const [weatherRes, marineRes, vesselsRes] = await Promise.allSettled([
      this.weatherAdapter.fetchWeatherMetrics(coord),
      this.marineService.getMarineObservation(coord, nearestRegion.name),
      Promise.resolve(this.vesselService.findNearbyLiveAisVessels(coord, 60)),
    ]);

    const sources: DataProvenance[] = [];

    // Weather normalization
    let weatherMetrics: PointWeatherMetrics;
    if (weatherRes.status === 'fulfilled') {
      const w: RawWeatherData = weatherRes.value;
      sources.push(w.provenance);
      weatherMetrics = {
        status: 'LIVE',
        temperatureCelsius: w.temperature2mCelsius,
        apparentTemperatureCelsius: w.apparentTemperatureCelsius,
        relativeHumidityPercent: w.relativeHumidityPercent,
        windSpeedKmh: w.wind.speedKmh,
        windDirectionDegrees: w.wind.directionDegrees,
        windGustsKmh: w.wind.gustsKmh,
        surfacePressureHpa: w.surfacePressureHpa,
        precipitationMm: w.precipitationMm,
        beaufortScale: w.wind.beaufortScale,
        beaufortDescription: w.wind.beaufortDescription,
        weatherCode: w.weatherCode,
        source: w.provenance,
      };
    } else {
      const errProvenance: DataProvenance = {
        provider: 'Open-Meteo Atmospheric Forecast API',
        retrievalTimestamp: new Date().toISOString(),
        observationTimestamp: new Date().toISOString(),
        verificationStatus: 'UNAVAILABLE',
      };
      sources.push(errProvenance);
      weatherMetrics = {
        status: 'UNAVAILABLE',
        source: errProvenance,
      };
    }

    // Marine normalization
    let marineMetrics: PointMarineMetrics;
    let marineObservationForSafety: MarineObservation;

    if (marineRes.status === 'fulfilled') {
      const m: MarineObservation = marineRes.value;
      marineObservationForSafety = m;
      sources.push(m.provenance);
      marineMetrics = {
        status: 'LIVE',
        waveHeightMeters: m.wave.heightMeters,
        waveDirectionDegrees: m.wave.directionDegrees,
        wavePeriodSeconds: m.wave.periodSeconds,
        waveCategory: m.wave.category,
        seaSurfaceTemperatureCelsius: m.seaSurfaceTemperatureCelsius,
        currentVelocityKmh: m.currents.velocityKmh,
        currentDirectionDegrees: m.currents.directionDegrees,
        isSafeForSmallCraft: m.isSafeForSmallCraft,
        advisoryText: m.advisoryText,
        source: m.provenance,
      };
    } else {
      const errProvenance: DataProvenance = {
        provider: 'Open-Meteo Marine API',
        retrievalTimestamp: new Date().toISOString(),
        observationTimestamp: new Date().toISOString(),
        verificationStatus: 'UNAVAILABLE',
      };
      sources.push(errProvenance);
      marineMetrics = {
        status: 'UNAVAILABLE',
        source: errProvenance,
      };
      // Synthetic fallback for safety evaluation so safety engine doesn't crash
      marineObservationForSafety = {
        id: `OBS-UNAVAILABLE-${Date.now()}`,
        coordinate: coord,
        coordinates: coord,
        locationName: nearestRegion.name,
        retrievedAt: new Date().toISOString(),
        observationTime: new Date().toISOString(),
        source: 'Open-Meteo Marine API',
        sourceStatus: 'UNAVAILABLE',
        wave: { heightMeters: 0, directionDegrees: 0, periodSeconds: 0, category: 'Calm' },
        wind: { speedKmh: weatherMetrics.windSpeedKmh ?? 0, gustsKmh: weatherMetrics.windGustsKmh ?? 0, directionDegrees: 0, beaufortScale: 0, beaufortDescription: 'Calm' },
        currents: { velocityKmh: 0, directionDegrees: 0 },
        seaSurfaceTemperatureCelsius: 28,
        isSafeForSmallCraft: true,
        advisoryText: 'Marine observation unavailable from external provider.',
        provenance: errProvenance,
      };
    }

    // Vessels normalization
    let vesselsSummary: PointVesselsSummary;
    if (vesselsRes.status === 'fulfilled') {
      vesselsSummary = vesselsRes.value;
      sources.push(vesselsSummary.source);
    } else {
      const errProvenance: DataProvenance = {
        provider: 'AISStream WebSocket Service',
        retrievalTimestamp: new Date().toISOString(),
        observationTimestamp: new Date().toISOString(),
        verificationStatus: 'UNAVAILABLE',
      };
      sources.push(errProvenance);
      vesselsSummary = {
        status: 'UNAVAILABLE',
        nearbyCount: 0,
        searchRadiusKm: 60,
        nearby: [],
        source: errProvenance,
      };
    }

    // 3. Deterministic Safety Assessment
    const safety: SafetyAssessment = this.safetyService.evaluateSafetyDirect(coord, marineObservationForSafety);

    const result: PointIntelligence = {
      coordinate: {
        latitude: parseFloat(coord.latitude.toFixed(4)),
        longitude: parseFloat(coord.longitude.toFixed(4)),
      },
      timestamp: new Date().toISOString(),
      location: locationContext,
      weather: weatherMetrics,
      marine: marineMetrics,
      vessels: vesselsSummary,
      spatial: spatialContext,
      safety,
      sources,
    };

    // Store in cache
    this.cache.set(cacheKey, { data: result, cachedAt: now });
    return result;
  }
}

// Singleton instance
const GLOBAL_POINT_SERVICE_KEY = '__aurexo_point_intelligence_service__';
export function getPointIntelligenceService(): PointIntelligenceService {
  const g = globalThis as unknown as Record<string, PointIntelligenceService | undefined>;
  if (!g[GLOBAL_POINT_SERVICE_KEY]) {
    g[GLOBAL_POINT_SERVICE_KEY] = new PointIntelligenceService();
  }
  return g[GLOBAL_POINT_SERVICE_KEY]!;
}
