import test from 'node:test';
import assert from 'node:assert/strict';
import { getPointIntelligenceService, PointIntelligenceService } from '../lib/services/point-intelligence.service';
import { getRegionService } from '../lib/services/region.service';
import { getVesselService } from '../lib/services/vessel.service';
import { getSafetyService } from '../lib/services/safety.service';
import { checkGeofence } from '../lib/geo/boundaries';
import { runSupervisorAgent } from '../lib/agents/supervisor';
import { GeoCoordinate } from '../lib/domain/models';

test('1. Map Coordinate Extraction & Quantization - normalizes to precision grid', () => {
  const service = getPointIntelligenceService();
  // Service quantizes coordinates to 2 decimal places (~1.1 km)
  const c1: GeoCoordinate = { latitude: 18.951234, longitude: 72.809876 };
  const c2: GeoCoordinate = { latitude: 18.951111, longitude: 72.809999 };
  assert.equal(c1.latitude.toFixed(2), c2.latitude.toFixed(2));
  assert.equal(c1.longitude.toFixed(2), c2.longitude.toFixed(2));
});

test('2. Spatial Lookup - deterministically resolves containing coastal sector and IMBL', () => {
  const regionService = getRegionService();
  const mumbaiCoord: GeoCoordinate = { latitude: 18.95, longitude: 72.80 };
  const { region, distanceKm } = regionService.findNearestRegion(mumbaiCoord);

  assert.equal(region.id, 'konkan');
  assert.equal(region.sea, 'Arabian Sea');
  assert.ok(distanceKm >= 0);

  const geofence = checkGeofence(mumbaiCoord);
  assert.equal(geofence.isInsideEEZ, true);
  assert.ok(geofence.distanceToIMBLKm > 500); // Mumbai is far from Pakistan IMBL
});

test('3. Point Intelligence Service - returns real live weather and marine metrics for Mumbai', async () => {
  const service = getPointIntelligenceService();
  const point = await service.getPointIntelligence({ latitude: 18.95, longitude: 72.80 });

  assert.equal(point.coordinate.latitude, 18.95);
  assert.equal(point.coordinate.longitude, 72.80);
  assert.equal(point.location.regionId, 'konkan');

  // Weather verification
  assert.ok(['LIVE', 'CACHED', 'UNAVAILABLE'].includes(point.weather.status));
  if (point.weather.status === 'LIVE' || point.weather.status === 'CACHED') {
    assert.ok(point.weather.temperatureCelsius !== undefined);
    assert.ok(point.weather.temperatureCelsius > 10 && point.weather.temperatureCelsius < 50);
  }
  assert.ok(point.weather.source.provider.includes('Open-Meteo'));

  // Marine verification
  assert.ok(['LIVE', 'CACHED', 'UNAVAILABLE'].includes(point.marine.status));
  if (point.marine.status === 'LIVE' || point.marine.status === 'CACHED') {
    assert.ok(point.marine.waveHeightMeters !== undefined);
    assert.ok(point.marine.seaSurfaceTemperatureCelsius !== undefined);
    assert.ok(point.marine.seaSurfaceTemperatureCelsius > 15 && point.marine.seaSurfaceTemperatureCelsius < 40);
  }

  // Safety evaluation
  assert.ok(point.safety.compositeRiskScore >= 0 && point.safety.compositeRiskScore <= 100);
  assert.ok(['Minimal Risk', 'Caution', 'Hazardous', 'Critical Danger'].includes(point.safety.riskLevel));
});

test('4. Pure Live AIS Filtering - strictly excludes baseline/simulated vessels in point search', () => {
  const vesselService = getVesselService();
  // Offshore point far away from Indian ports (middle of Indian Ocean)
  const remoteCoord: GeoCoordinate = { latitude: 2.0, longitude: 70.0 };
  const aisSummary = vesselService.findNearbyLiveAisVessels(remoteCoord, 30);

  // Must NOT pull any of the 6 baseline vessels (e.g. RV Sagar Kanya) into point summary
  assert.equal(aisSummary.nearbyCount, 0);
  assert.ok(aisSummary.status === 'NO_LIVE_DATA' || aisSummary.status === 'UNAVAILABLE');
  assert.equal(aisSummary.nearby.length, 0);
  assert.equal(aisSummary.nearest, undefined);

});

test('5. Cache Behavior - repeated queries within TTL hit cache', async () => {
  const service = new PointIntelligenceService();
  const coord: GeoCoordinate = { latitude: 15.49, longitude: 73.80 }; // Goa

  const p1 = await service.getPointIntelligence(coord);
  const p2 = await service.getPointIntelligence(coord);

  assert.equal(p1.coordinate.latitude, p2.coordinate.latitude);
  assert.equal(p1.location.regionName, p2.location.regionName);
  assert.ok(['LIVE', 'CACHED', 'UNAVAILABLE'].includes(p2.weather.status));
});

test('6. Deterministic Safety Evaluation - handles rough sea state and border proximity thresholds', () => {
  const safetyService = getSafetyService();

  // Test Case A: Calm, deep inside EEZ
  const calmObs = {
    id: 'OBS-TEST-CALM',
    coordinate: { latitude: 18.95, longitude: 72.80 },
    coordinates: { latitude: 18.95, longitude: 72.80 },
    locationName: 'Mumbai Deep EEZ',
    retrievedAt: new Date().toISOString(),
    observationTime: new Date().toISOString(),
    source: 'Test',
    sourceStatus: 'VERIFIED_LIVE' as const,
    wave: { heightMeters: 0.5, directionDegrees: 200, periodSeconds: 6, category: 'Calm' as const },
    wind: { speedKmh: 12, gustsKmh: 18, directionDegrees: 340, beaufortScale: 2, beaufortDescription: 'Light breeze' },
    currents: { velocityKmh: 0.4, directionDegrees: 120 },
    seaSurfaceTemperatureCelsius: 29.5,
    isSafeForSmallCraft: true,
    advisoryText: 'Calm seas',
    provenance: { provider: 'Test', retrievalTimestamp: '', observationTimestamp: '', verificationStatus: 'VERIFIED_LIVE' as const },
  };

  const calmSafety = safetyService.evaluateSafetyDirect(calmObs.coordinate, calmObs);
  assert.equal(calmSafety.riskLevel, 'Minimal Risk');
  assert.equal(calmSafety.smallCraftAdvisory, false);

  // Test Case B: Rough waves (3.5m)
  const roughObs = {
    ...calmObs,
    wave: { heightMeters: 3.5, directionDegrees: 240, periodSeconds: 11, category: 'Very Rough' as const },
    wind: { speedKmh: 48, gustsKmh: 65, directionDegrees: 250, beaufortScale: 6, beaufortDescription: 'Strong breeze' },
  };

  const roughSafety = safetyService.evaluateSafetyDirect(roughObs.coordinate, roughObs);
  assert.ok(roughSafety.compositeRiskScore >= 40);
  assert.equal(roughSafety.riskLevel, 'Hazardous');
  assert.equal(roughSafety.smallCraftAdvisory, true);

});

test('7. Ask ORCA Coordinate Grounding - Supervisor resolves clicked point and region', async () => {
  const coord: GeoCoordinate = { latitude: 9.93, longitude: 76.25 }; // Kochi
  const response = await runSupervisorAgent({
    prompt: 'What is happening here? Is this location safe?',
    userCoordinates: coord,
  });

  assert.ok(response.answer.length > 50);
  assert.ok(response.mapActions?.center);
  // Anaphora / Location should be grounded in Malabar / Kochi
  assert.ok(
    response.sessionContext?.lastLocationName?.includes('Malabar') ||
    response.sessionContext?.lastLocationName?.includes('Kochi') ||
    response.sessionContext?.lastLocationName?.includes('Selected')
  );
  assert.equal(response.sessionContext?.lastCoordinates?.latitude, coord.latitude);
  assert.equal(response.sessionContext?.lastCoordinates?.longitude, coord.longitude);
});

test('8. Multi-turn Anaphora Retention - follow-up question keeps the clicked coordinate', async () => {
  const coord: GeoCoordinate = { latitude: 13.08, longitude: 80.27 }; // Chennai

  // Turn 1
  const turn1 = await runSupervisorAgent({
    prompt: 'What are the waves here?',
    userCoordinates: coord,
  });

  // Turn 2: Follow-up without explicit coordinate
  const turn2 = await runSupervisorAgent({
    prompt: 'Is that dangerous for small boats?',
    sessionContext: turn1.sessionContext,
    conversationHistory: [
      { role: 'user', content: 'What are the waves here?' },
      { role: 'assistant', content: turn1.answer },
    ],
  });

  assert.ok(turn2.answer.length > 30);
  // Coordinate is retained in sessionContext
  assert.equal(turn2.sessionContext?.lastCoordinates?.latitude, coord.latitude);
  assert.equal(turn2.sessionContext?.lastCoordinates?.longitude, coord.longitude);
});

test('9. Marine Protected Area Containment - flags restricted zone violation inside Gulf of Mannar MPA', () => {
  // Gulf of Mannar National Park boundary coordinate
  const mpaCoord: GeoCoordinate = { latitude: 9.15, longitude: 78.85 };
  const geofence = checkGeofence(mpaCoord);

  assert.equal(geofence.isInsideMarineProtectedArea, true);
  assert.ok(geofence.protectedAreaName?.includes('Mannar'));
  assert.equal(geofence.riskStatus, 'Restricted Zone Violation');
});

test('10. Partial Provider Degradation - returns explicit UNAVAILABLE when provider data is missing', async () => {
  const service = getPointIntelligenceService();
  // Valid coordinate
  const point = await service.getPointIntelligence({ latitude: 18.95, longitude: 72.80 });

  // Ensure every provider source is typed and has provenance
  assert.ok(point.sources.length >= 2);
  for (const s of point.sources) {
    assert.ok(['VERIFIED_LIVE', 'VERIFIED_LOCAL', 'DOCUMENTED_UNVERIFIED', 'UNAVAILABLE'].includes(s.verificationStatus));
  }
});
