import { GeoCoordinate } from './domain';

export type OverallRiskLevel = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'CRITICAL';

export interface UnifiedSafetyAssessment {
  coordinate: GeoCoordinate;
  locationName: string;
  overallRisk: OverallRiskLevel;
  riskScore: number; // 0 (calm) to 100 (extreme danger)
  primaryHazard?: string;
  factors: {
    wave: {
      heightMeters: number;
      periodSeconds: number;
      category: string;
      level: 'Low' | 'Moderate' | 'High' | 'Severe';
    };
    wind: {
      speedKmh: number;
      gustsKmh: number;
      beaufortScale: number;
      beaufortDescription: string;
      level: 'Low' | 'Moderate' | 'Gale' | 'Storm';
    };
    boundary: {
      distanceToIMBLKm: number;
      nearestNeighbor: string;
      isInsideMPA: boolean;
      mpaName?: string;
      level: 'Safe' | 'Buffer' | 'Proximity Warning' | 'Violation';
    };
  };
  operationalGuidance: string;
  isSafeForSmallCraft: boolean;
  evaluatedAt: string;
  sourceTimestamps: {
    marineObservation?: string;
    boundaryEvaluation: string;
  };
}
