import { GeoCoordinate, SafetyAssessment, SafetyFactorScore, UnifiedRiskLevel } from '../domain/models';
import { getMarineService } from './marine.service';
import { checkGeofence } from '../geo/boundaries';

export class SafetyService {
  private marineService = getMarineService();

  async evaluateSafety(
    coordinate: GeoCoordinate,
    locationName: string = 'Offshore Sector'
  ): Promise<SafetyAssessment> {
    const observation = await this.marineService.getMarineObservation(coordinate, locationName);
    const geofence = checkGeofence(coordinate);

    // 1. Wave Severity (0-100)
    const waveM = observation.wave.heightMeters;
    let waveScore = 15;
    if (waveM >= 4.0) waveScore = 100;
    else if (waveM >= 2.5) waveScore = 75;
    else if (waveM >= 1.5) waveScore = 45;
    else if (waveM >= 0.8) waveScore = 25;

    // 2. Wind Hazard (0-100)
    const windK = observation.wind.speedKmh;
    let windScore = 10;
    if (windK >= 65) windScore = 100;
    else if (windK >= 45) windScore = 75;
    else if (windK >= 35) windScore = 50;
    else if (windK >= 20) windScore = 25;

    // 3. Border Proximity (0-100)
    const distIMBL = geofence.distanceToIMBLKm;
    let borderScore = 5;
    if (distIMBL <= 5) borderScore = 100;
    else if (distIMBL <= 15) borderScore = 80;
    else if (distIMBL <= 35) borderScore = 45;
    else if (distIMBL <= 60) borderScore = 20;

    // 4. Restricted Zone Infringement (0-100)
    let mpaScore = 0;
    if (geofence.isInsideMarineProtectedArea) {
      mpaScore = 100;
    }

    const factors: SafetyFactorScore[] = [
      {
        name: 'Wave Severity',
        rawScore: waveScore,
        weight: 0.35,
        weightedScore: Math.round(waveScore * 0.35),
        description: `Wave height: ${waveM.toFixed(1)}m (${observation.wave.category})`,
      },
      {
        name: 'Wind Hazard',
        rawScore: windScore,
        weight: 0.25,
        weightedScore: Math.round(windScore * 0.25),
        description: `Wind speed: ${windK.toFixed(1)} km/h (${observation.wind.beaufortDescription})`,
      },
      {
        name: 'Border Proximity',
        rawScore: borderScore,
        weight: 0.25,
        weightedScore: Math.round(borderScore * 0.25),
        description: `Distance to IMBL: ${distIMBL.toFixed(1)} km (${geofence.nearestNeighborCountry})`,
      },
      {
        name: 'Restricted Zone Infringement',
        rawScore: mpaScore,
        weight: 0.15,
        weightedScore: Math.round(mpaScore * 0.15),
        description: geofence.isInsideMarineProtectedArea
          ? `Inside ${geofence.protectedAreaName ?? 'Marine Protected Reserve'}`
          : 'Clear of designated ecological sanctuaries',
      },
    ];

    const compositeRiskScore = Math.min(
      100,
      factors.reduce((acc, f) => acc + f.weightedScore, 0)
    );

    let riskLevel: UnifiedRiskLevel = 'Minimal Risk';
    if (compositeRiskScore >= 75 || mpaScore >= 100 || distIMBL <= 5 || waveM >= 4.0) {
      riskLevel = 'Critical Danger';
    } else if (compositeRiskScore >= 50 || distIMBL <= 15 || waveM >= 2.5) {
      riskLevel = 'Hazardous';
    } else if (compositeRiskScore >= 25 || distIMBL <= 35 || waveM >= 1.5) {
      riskLevel = 'Caution';
    }

    // Determine primary driver
    let primaryRiskFactor = 'Normal sea state and border clearance';
    const sorted = [...factors].sort((a, b) => b.rawScore - a.rawScore);
    if (sorted[0].rawScore > 30) {
      primaryRiskFactor = sorted[0].description;
    }

    const smallCraftAdvisory = waveM >= 2.0 || windK >= 35 || distIMBL <= 15 || mpaScore > 0;

    let recommendedAction = 'Favorable conditions for navigation and fishing.';
    if (riskLevel === 'Critical Danger') {
      recommendedAction =
        'IMMEDIATE ACTION REQUIRED: Alter course away from border/restricted zone or seek port shelter immediately.';
    } else if (riskLevel === 'Hazardous') {
      recommendedAction =
        'High caution: Artisanal craft should return to port. Maintain continuous VHF watch and broadcast AIS.';
    } else if (riskLevel === 'Caution') {
      recommendedAction =
        'Standard caution: Monitor sea state changes and verify GPS position relative to international borders.';
    }

    return {
      coordinate,
      compositeRiskScore,
      riskLevel,
      primaryRiskFactor,
      factors,
      smallCraftAdvisory,
      recommendedAction,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
const GLOBAL_SAFETY_SERVICE_KEY = '__aurexo_safety_service__';
export function getSafetyService(): SafetyService {
  const g = globalThis as unknown as Record<string, SafetyService | undefined>;
  if (!g[GLOBAL_SAFETY_SERVICE_KEY]) {
    g[GLOBAL_SAFETY_SERVICE_KEY] = new SafetyService();
  }
  return g[GLOBAL_SAFETY_SERVICE_KEY]!;
}
