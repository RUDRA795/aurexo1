/**
 * ORCA CANONICAL DOMAIN MODELS
 * Single source of truth for all domain entities across ORCA Marine Intelligence Platform.
 * ONE FACT -> ONE CANONICAL DOMAIN OBJECT -> MANY PROJECTIONS.
 */

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export type VerificationStatus =
  | 'VERIFIED_LIVE'
  | 'VERIFIED_LOCAL'
  | 'DOCUMENTED_UNVERIFIED'
  | 'UNAVAILABLE';

export interface DataProvenance {
  provider: string;
  endpoint?: string;
  retrievalTimestamp: string;
  observationTimestamp: string;
  verificationStatus: VerificationStatus;
}

export interface WaveMetrics {
  heightMeters: number;
  directionDegrees: number;
  periodSeconds: number;
  category: 'Calm' | 'Moderate' | 'Rough' | 'Very Rough' | 'Phenomenal';
}

export interface WindMetrics {
  speedKmh: number;
  gustsKmh: number;
  directionDegrees: number;
  beaufortScale: number;
  beaufortDescription: string;
}

export interface CurrentMetrics {
  velocityKmh: number;
  directionDegrees: number;
}

export interface MarineObservation {
  id: string;
  coordinate: GeoCoordinate;
  coordinates: GeoCoordinate;
  locationName: string;
  retrievedAt: string;
  observationTime: string;
  source: string;
  sourceStatus: VerificationStatus;
  wave: WaveMetrics;
  wind: WindMetrics;
  currents: CurrentMetrics;
  seaSurfaceTemperatureCelsius: number;
  isSafeForSmallCraft: boolean;
  advisoryText: string;
  provenance: DataProvenance;
}

export interface MarineForecastPoint {
  timestamp: string;
  waveHeightMeters: number;
  windSpeedKmh: number;
  gustsKmh: number;
  temperatureCelsius: number;
}

export interface MarineForecast {
  coordinate: GeoCoordinate;
  locationName: string;
  generatedAt: string;
  hourly: MarineForecastPoint[];
  provenance: DataProvenance;
}

export type VesselType =
  | 'Artisanal Fishing'
  | 'Deep-Sea Trawler'
  | 'Research Vessel'
  | 'Coast Guard Patrol'
  | 'Cargo / Tanker';

export type VesselRegistrationSource = 'AIS' | 'USER_REGISTERED';
export type VesselDataLiveness = 'LIVE' | 'STALE' | 'UNAVAILABLE';

export interface VesselPosition {
  coordinate: GeoCoordinate;
  speedKnots: number;
  headingDegrees: number;
  timestamp: string;
}

export interface Vessel {
  id: string;
  mmsi: string;
  name: string;
  callsign: string;
  vesselType: VesselType;
  position: VesselPosition;
  destination: string;
  draftMeters: number;
  lengthMeters: number;
  source: VesselRegistrationSource;
  liveness: VesselDataLiveness;
  lastUpdated: string;
  notes?: string;
}

export interface NearestVesselResult {
  vessel: Vessel;
  distanceKm: number;
  distanceNauticalMiles: number;
  bearingDegrees: number;
}

export interface RegionMetadata {
  id: string;
  name: string;
  state: string;
  sea: 'Arabian Sea' | 'Bay of Bengal' | 'Indian Ocean' | 'Lakshadweep Sea' | 'Andaman Sea';
  center: GeoCoordinate;
  boundingBox: BoundingBox;
  primaryPorts: string[];
  vulnerableHazards: Array<
    'Cyclones' | 'High Waves' | 'Swell Surge (Kallakkadal)' | 'IMBL Proximity' | 'Shallow Reefs' | string
  >;
  description: string;
}

export interface RegionalState {
  region: RegionMetadata;
  observation: MarineObservation;
  activeAlerts: MarineAlert[];
  isSeaRough: boolean;
  evaluatedAt: string;
}

export type AlertSeverity = 'Advisory' | 'Watch' | 'Warning' | 'Emergency';
export type AlertHazardType = 'High Wave' | 'Rough Sea' | 'Cyclone' | 'Squall' | 'Swell Surge';

export interface MarineAlert {
  id: string;
  severity: AlertSeverity;
  hazardType: AlertHazardType;
  affectedRegion: string;
  headline: string;
  description: string;
  issuedAt: string;
  validUntil: string;
  recommendedAction: string;
  provenance: DataProvenance;
}

export interface PFZZone {
  id: string;
  name: string;
  coordinate: GeoCoordinate;
  distanceFromCoastKm: number;
  depthMeters: number;
  targetSpecies: string[];
  chlorophyllStatus: string;
}

export interface PFZAdvisory {
  sector: string;
  zones: PFZZone[];
  guidance: string;
  provenance: DataProvenance;
}

export type GeofenceRiskStatus =
  | 'Safe'
  | 'Caution'
  | 'Border Proximity Warning'
  | 'Restricted Zone Violation';

export interface GeofenceResult {
  coordinate: GeoCoordinate;
  isInsideEEZ: boolean;
  distanceToIMBLKm: number;
  nearestNeighborCountry: string;
  isInsideMarineProtectedArea: boolean;
  protectedAreaName?: string;
  riskStatus: GeofenceRiskStatus;
  notes: string;
}

export interface RoutePassageWaypoint {
  coordinate: GeoCoordinate;
  distanceFromOriginKm: number;
  geofenceCheck: GeofenceResult;
}

export interface RouteResult {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  originName: string;
  destinationName: string;
  totalDistanceKm: number;
  estimatedTravelTimeHours: number;
  waypoints: RoutePassageWaypoint[];
  routeGeometry: GeoJSON.LineString;
  overallSafety: 'Safe' | 'Caution' | 'High Risk';
  advisory: string;
}

export type UnifiedRiskLevel = 'Minimal Risk' | 'Caution' | 'Hazardous' | 'Critical Danger';

export interface SafetyFactorScore {
  name: 'Wave Severity' | 'Wind Hazard' | 'Border Proximity' | 'Restricted Zone Infringement';
  rawScore: number;
  weight: number;
  weightedScore: number;
  description: string;
}

export interface SafetyAssessment {
  coordinate: GeoCoordinate;
  compositeRiskScore: number;
  riskLevel: UnifiedRiskLevel;
  primaryRiskFactor: string;
  factors: SafetyFactorScore[];
  smallCraftAdvisory: boolean;
  recommendedAction: string;
  evaluatedAt: string;
}

export interface AgentExecutionStep {
  agent: 'Supervisor' | 'Ocean' | 'WeatherHazard' | 'SpatialSentinel' | 'Vessel' | 'BlueEconomy';
  action: string;
  toolUsed?: string;
  status: 'executing' | 'completed' | 'flagged';
  durationMs: number;
  summary: string;
  timestamp: string;
}

export interface AgentExecutionTrace {
  steps: AgentExecutionStep[];
  totalDurationMs: number;
  consensusSummary: string;
}

export interface SessionState {
  sessionId?: string;
  lastCoordinates?: GeoCoordinate;
  lastLocationName?: string;
  lastActiveLayer?: string;
  updatedAt: string;
}

export type DataStatus = 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';
export type VesselDataStatus = 'LIVE' | 'NO_LIVE_DATA' | 'UNAVAILABLE';

export interface PointWeatherMetrics {
  status: DataStatus;
  temperatureCelsius?: number;
  apparentTemperatureCelsius?: number;
  relativeHumidityPercent?: number;
  windSpeedKmh?: number;
  windDirectionDegrees?: number;
  windGustsKmh?: number;
  surfacePressureHpa?: number;
  precipitationMm?: number;
  beaufortScale?: number;
  beaufortDescription?: string;
  weatherCode?: number;
  source: DataProvenance;
}

export interface PointMarineMetrics {
  status: DataStatus;
  waveHeightMeters?: number;
  waveDirectionDegrees?: number;
  wavePeriodSeconds?: number;
  waveCategory?: string;
  swellHeightMeters?: number;
  swellDirectionDegrees?: number;
  swellPeriodSeconds?: number;
  seaSurfaceTemperatureCelsius?: number;
  currentVelocityKmh?: number;
  currentDirectionDegrees?: number;
  isSafeForSmallCraft?: boolean;
  advisoryText?: string;
  source: DataProvenance;
}

export interface PointNearbyVessel {
  mmsi: string;
  name: string;
  vesselType: string;
  distanceKm: number;
  distanceNauticalMiles: number;
  bearingDegrees: number;
  speedKnots: number;
  headingDegrees: number;
  sourceStatus: string;
  lastUpdated: string;
}

export interface PointVesselsSummary {
  status: VesselDataStatus;
  nearbyCount: number;
  searchRadiusKm: number;
  nearby: PointNearbyVessel[];
  nearest?: {
    mmsi: string;
    name: string;
    vesselType: string;
    distanceKm: number;
    distanceNauticalMiles: number;
    bearingDegrees: number;
  };
  source: DataProvenance;
}

export interface PointLocationContext {
  regionId?: string;
  regionName: string;
  sea?: string;
  state?: string;
  distanceToCoastKm?: number;
  spatialContext: string;
}

export interface PointSpatialContext {
  regionName: string;
  isInsideEEZ: boolean;
  distanceToIMBLKm: number;
  nearestNeighborCountry: string;
  isInsideMarineProtectedArea: boolean;
  protectedAreaName?: string;
  riskStatus: string;
  notes: string;
}

export interface PointIntelligence {
  coordinate: GeoCoordinate;
  timestamp: string;
  location: PointLocationContext;
  weather: PointWeatherMetrics;
  marine: PointMarineMetrics;
  vessels: PointVesselsSummary;
  spatial: PointSpatialContext;
  safety: SafetyAssessment;
  sources: DataProvenance[];
}

