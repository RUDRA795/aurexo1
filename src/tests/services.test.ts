import test from 'node:test';
import assert from 'node:assert/strict';
import { getMarineService } from '../lib/services/marine.service';
import { getRegionService } from '../lib/services/region.service';
import { getVesselService } from '../lib/services/vessel.service';
import { getRouteService } from '../lib/services/route.service';
import { getSafetyService } from '../lib/services/safety.service';
import { getPfzService } from '../lib/services/pfz.service';
import { getSatelliteService } from '../lib/services/satellite.service';

test('MarineService fetches validated canonical MarineObservation', async () => {
  const service = getMarineService();
  const obs = await service.getMarineObservation({ latitude: 18.95, longitude: 72.80 }, 'Mumbai Offshore');

  assert.ok(obs.id);
  assert.equal(obs.coordinate.latitude, 18.95);
  assert.equal(obs.coordinate.longitude, 72.80);
  assert.ok(obs.wave.heightMeters >= 0 && obs.wave.heightMeters < 15);
  assert.ok(obs.wind.speedKmh >= 0 && obs.wind.speedKmh < 200);
  assert.ok(obs.seaSurfaceTemperatureCelsius >= 10 && obs.seaSurfaceTemperatureCelsius <= 40);
  assert.equal(obs.provenance.verificationStatus, 'VERIFIED_LIVE');
});

test('VesselService provides unified catalog and nearest vessel calculation', () => {
  const service = getVesselService();
  const vessels = service.getAllVessels();
  assert.ok(vessels.length >= 6);

  const nearest = service.findNearestVessel({ latitude: 18.95, longitude: 72.80 });
  assert.ok(nearest);
  assert.ok(nearest.distanceKm >= 0);
  assert.ok(nearest.bearingDegrees >= 0 && nearest.bearingDegrees <= 360);

  const tele = service.getFleetTelemetry();
  assert.ok(typeof tele.liveCount === 'number');
  assert.ok(typeof tele.userCount === 'number');
});

test('RouteService produces deterministic multi-port corridor between Mumbai and Goa', async () => {
  const service = getRouteService();
  const route = await service.computePassageCorridor(
    { latitude: 18.95, longitude: 72.80 },
    { latitude: 15.49, longitude: 73.80 },
    'Mumbai',
    'Goa'
  );

  assert.ok(route.totalDistanceKm > 350 && route.totalDistanceKm < 500);
  assert.equal(route.waypoints.length, 6);
  assert.equal(route.routeGeometry.type, 'LineString');
  assert.ok(route.overallSafety === 'Safe' || route.overallSafety === 'Caution');
  assert.ok(route.advisory.length > 0);
});

test('SafetyService evaluates multi-factor deterministic risk score', async () => {
  const service = getSafetyService();
  const safety = await service.evaluateSafety({ latitude: 18.95, longitude: 72.80 }, 'Mumbai');

  assert.ok(safety.compositeRiskScore >= 0 && safety.compositeRiskScore <= 100);
  assert.ok(['Minimal Risk', 'Caution', 'Hazardous', 'Critical Danger'].includes(safety.riskLevel));
  assert.equal(safety.factors.length, 4);
  assert.ok(typeof safety.smallCraftAdvisory === 'boolean');
});

test('RegionService separates static metadata from warning scans', () => {
  const service = getRegionService();
  const all = service.getAllRegions();
  assert.equal(all.length, 9);

  const matched = service.findRegionByName('Kochi harbor');
  assert.ok(matched);
  assert.equal(matched.id, 'malabar');
});

test('PFZService computes Habitat Suitability Index based on thermal bands', () => {
  const service = getPfzService();
  const optimalScore = service.calculateHabitatSuitabilityScore(28.0);
  const stressScore = service.calculateHabitatSuitabilityScore(32.5);

  assert.ok(optimalScore >= 85);
  assert.ok(stressScore <= 50);
});

test('SatelliteService returns verified NASA and INCOIS layer configurations', () => {
  const service = getSatelliteService();
  const configs = service.getAllLayerConfigs();

  assert.ok(configs.truecolor.tileUrl);
  assert.ok(configs.sst.tileUrl);
  assert.ok(configs.chlorophyll.tileUrl);
  assert.ok(configs.incois_coral.tileUrl);
  assert.ok(configs.incois_pfz.tileUrl);
});
