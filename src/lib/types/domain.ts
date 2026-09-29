export type IntegrationStatus = 'VERIFIED_LIVE' | 'DOCUMENTED_UNVERIFIED' | 'UNAVAILABLE';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface MarineObservation {
  locationName: string;
  coordinates: GeoCoordinate;
  retrievedAt: string;
  observationTime: string;
  source: string;
  sourceStatus: IntegrationStatus;
  wave: {
    heightMeters: number;
    directionDegrees: number;
    periodSeconds: number;
    category: 'Calm' | 'Moderate' | 'Rough' | 'Very Rough' | 'Phenomenal';
  };
  wind: {
    speedKmh: number;
    gustsKmh: number;
    directionDegrees: number;
    beaufortScale: number;
    beaufortDescription: string;
  };
  currents: {
    velocityKmh: number;
    directionDegrees: number;
  };
  seaSurfaceTemperatureCelsius: number;
  isSafeForSmallCraft: boolean;
  advisoryText: string;
}

export type SatelliteLayerId = 'none' | 'truecolor' | 'sst' | 'chlorophyll';

export interface SatelliteLayerConfig {
  id: SatelliteLayerId;
  name: string;
  description: string;
  layerType: 'satellite imagery' | 'satellite-derived layer';
  wmsLayerName?: string;
  tileUrl?: string;
  attribution: string;
  legend?: {
    min: string;
    max: string;
    unit: string;
    gradient: string;
  };
}

export interface GeofenceCheckResult {
  isInsideEEZ: boolean;
  distanceToIMBLKm: number;
  nearestNeighborCountry: string;
  isInsideMarineProtectedArea: boolean;
  protectedAreaName?: string;
  riskStatus: 'Safe' | 'Caution' | 'Border Proximity Warning' | 'Restricted Zone Violation';
  notes: string;
}

export interface PFZAdvisoryResult {
  sector: string;
  status: IntegrationStatus;
  message: string;
  zones: Array<{
    id: string;
    name: string;
    coordinates: GeoCoordinate;
    distanceFromCoastKm: number;
    targetSpecies: string[];
    depthMeters: number;
    chlorophyllStatus: string;
  }>;
}

export interface MarineHazardAlert {
  id: string;
  severity: 'Advisory' | 'Watch' | 'Warning' | 'Emergency';
  hazardType: 'High Wave' | 'Rough Sea' | 'Cyclone' | 'Squall' | 'Swell Surge';
  affectedRegion: string;
  headline: string;
  description: string;
  issuedAt: string;
  validUntil: string;
  recommendedAction: string;
  status: IntegrationStatus;
  source: string;
}

export interface AgentEvidenceSource {
  name: string;
  status: IntegrationStatus;
  retrievedAt: string;
  observationTime?: string;
  endpoint?: string;
}

export interface AgentResponse {
  answer: string;
  intent: string;
  toolsUsed: string[];
  evidence: {
    sources: AgentEvidenceSource[];
    measurements?: Record<string, unknown>;
    geofence?: GeofenceCheckResult;
    timestamp: string;
  };
  mapActions?: {
    center?: [number, number]; // [longitude, latitude]
    zoom?: number;
    activeLayer?: SatelliteLayerId;
    highlightGeometry?: GeoJSON.Geometry;
  };
  llmMetadata: {
    provider: 'gemini' | 'ollama' | 'rule_fallback';
    model: string;
    executionTimeMs: number;
    escalated: boolean;
  };
}
