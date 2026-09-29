import { GeoCoordinate } from '../types/domain';
import { UnifiedSafetyAssessment, OverallRiskLevel } from '../types/safety';
import { fetchMarineConditions } from './marine-conditions';
import { checkGeofence } from '../geo/boundaries';

/**
 * Unified Marine Safety Engine.
 * Fuses physical ocean observations with deterministic geopolitical boundary math.
 */
export async function evaluateUnifiedSafety(
  coordinate: GeoCoordinate,
  locationName: string = 'Maritime Sector'
): Promise<UnifiedSafetyAssessment> {
  const [conditions, geofence] = await Promise.all([
    fetchMarineConditions(coordinate, locationName),
    Promise.resolve(checkGeofence(coordinate)),
  ]);

  let score = 0;
  let primaryHazard = 'None';

  // 1. Wave risk score (0 - 40 points)
  const wave = conditions.wave.heightMeters;
  let waveLevel: 'Low' | 'Moderate' | 'High' | 'Severe' = 'Low';
  if (wave >= 4.0) {
    score += 40;
    waveLevel = 'Severe';
    primaryHazard = 'Phenomenal Wave Height (>4m)';
  } else if (wave >= 2.5) {
    score += 28;
    waveLevel = 'High';
    primaryHazard = primaryHazard === 'None' ? 'Rough Sea (Wave >2.5m)' : primaryHazard;
  } else if (wave >= 1.5) {
    score += 15;
    waveLevel = 'Moderate';
  }

  // Swell surge (Kallakkadal) bonus: swell period >= 14s with moderate wave
  if (conditions.wave.periodSeconds >= 14 && wave >= 1.2) {
    score += 15;
    primaryHazard = 'Kallakkadal / Distant Swell Surge';
  }

  // 2. Wind risk score (0 - 30 points)
  const wind = conditions.wind.speedKmh;
  let windLevel: 'Low' | 'Moderate' | 'Gale' | 'Storm' = 'Low';
  if (wind >= 55 || conditions.wind.gustsKmh >= 70) {
    score += 30;
    windLevel = 'Storm';
    primaryHazard = 'Storm-Force Winds';
  } else if (wind >= 38 || conditions.wind.gustsKmh >= 50) {
    score += 20;
    windLevel = 'Gale';
    primaryHazard = primaryHazard === 'None' ? 'Gale-Force Squall' : primaryHazard;
  } else if (wind >= 25) {
    score += 10;
    windLevel = 'Moderate';
  }

  // 3. Boundary & MPA risk score (0 - 40 points)
  let boundaryLevel: 'Safe' | 'Buffer' | 'Proximity Warning' | 'Violation' = 'Safe';
  if (geofence.isInsideMarineProtectedArea) {
    score += 35;
    boundaryLevel = 'Violation';
    primaryHazard = `Protected Reserve Violation (${geofence.protectedAreaName})`;
  } else if (geofence.distanceToIMBLKm <= 12) {
    score += 35;
    boundaryLevel = 'Proximity Warning';
    primaryHazard = `Critical Proximity to ${geofence.nearestNeighborCountry} IMBL (${geofence.distanceToIMBLKm} km)`;
  } else if (geofence.distanceToIMBLKm <= 35) {
    score += 15;
    boundaryLevel = 'Buffer';
    primaryHazard = primaryHazard === 'None' ? `Operating in ${geofence.nearestNeighborCountry} Frontier Buffer` : primaryHazard;
  }

  // Cap score at 100
  score = Math.min(100, score);

  let overallRisk: OverallRiskLevel = 'SAFE';
  let guidance = '';

  if (score >= 65) {
    overallRisk = 'CRITICAL';
    guidance = `Critical Danger: ${primaryHazard}. Small vessels must return to port immediately. Maintain active radio distress monitoring.`;
  } else if (score >= 40) {
    overallRisk = 'HIGH_RISK';
    guidance = `High Risk: ${primaryHazard}. Unfavorable for artisanal craft. Navigators must exercise strict vigilance and steer clear of frontier buffers.`;
  } else if (score >= 20) {
    overallRisk = 'CAUTION';
    guidance = `Caution: Moderate sea activity or maritime buffer zone detected. Maintain VHF radio watch and life jacket readiness.`;
  } else {
    overallRisk = 'SAFE';
    guidance = 'Safe conditions: Calm sea state and clear territorial waters. Standard commercial and fishing passage permitted.';
  }

  return {
    coordinate,
    locationName,
    overallRisk,
    riskScore: score,
    primaryHazard: primaryHazard === 'None' ? undefined : primaryHazard,
    factors: {
      wave: {
        heightMeters: wave,
        periodSeconds: conditions.wave.periodSeconds,
        category: conditions.wave.category,
        level: waveLevel,
      },
      wind: {
        speedKmh: wind,
        gustsKmh: conditions.wind.gustsKmh,
        beaufortScale: conditions.wind.beaufortScale,
        beaufortDescription: conditions.wind.beaufortDescription,
        level: windLevel,
      },
      boundary: {
        distanceToIMBLKm: geofence.distanceToIMBLKm,
        nearestNeighbor: geofence.nearestNeighborCountry,
        isInsideMPA: geofence.isInsideMarineProtectedArea,
        mpaName: geofence.protectedAreaName,
        level: boundaryLevel,
      },
    },
    operationalGuidance: guidance,
    isSafeForSmallCraft: score < 25,
    evaluatedAt: new Date().toISOString(),
    sourceTimestamps: {
      marineObservation: conditions.observationTime,
      boundaryEvaluation: new Date().toISOString(),
    },
  };
}
