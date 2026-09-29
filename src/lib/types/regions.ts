import { GeoCoordinate, IntegrationStatus } from './domain';

export interface MaritimeRegion {
  id: string;
  name: string;
  state: string;
  sea: 'Arabian Sea' | 'Bay of Bengal' | 'Indian Ocean' | 'Lakshadweep Sea' | 'Andaman Sea';
  center: GeoCoordinate;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  primaryPorts: string[];
  vulnerableHazards: Array<'Cyclones' | 'High Waves' | 'Swell Surge (Kallakkadal)' | 'IMBL Proximity' | 'Shallow Reefs'>;
  description: string;
}

export interface RegionalMarineState {
  regionId: string;
  regionName: string;
  sea: string;
  center: GeoCoordinate;
  activeWarningsCount: number;
  isSeaRough: boolean;
  representativeObservation?: {
    waveHeightMeters: number;
    windSpeedKmh: number;
    sstCelsius: number;
    sourceStatus: IntegrationStatus;
    observationTime: string;
  };
  safetySummary: string;
}
