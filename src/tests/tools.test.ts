import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMarineConditions } from '../lib/tools/marine-conditions';
import { SATELLITE_LAYERS, buildGibsWmsUrl } from '../lib/tools/satellite-layers';

test('fetchMarineConditions returns valid live schema within physical oceanic bounds', async () => {
  // Test coordinate: Arabian sea offshore Mumbai
  const coord = { latitude: 18.95, longitude: 72.80 };
  const obs = await fetchMarineConditions(coord, 'Mumbai Offshore');

  // 1. Structure and metadata assertions
  assert.equal(obs.locationName, 'Mumbai Offshore');
  assert.equal(obs.coordinates.latitude, 18.95);
  assert.equal(obs.coordinates.longitude, 72.80);
  assert.equal(obs.sourceStatus, 'VERIFIED_LIVE');
  assert.ok(obs.source.includes('Open-Meteo'));

  // 2. ISO Timestamp validation
  assert.ok(!isNaN(Date.parse(obs.retrievedAt)), 'retrievedAt must be valid ISO8601');
  assert.ok(!isNaN(Date.parse(obs.observationTime)), 'observationTime must be valid ISO8601');

  // 3. Physical oceanic ranges (No hardcoded numbers!)
  assert.equal(typeof obs.wave.heightMeters, 'number');
  assert.ok(!isNaN(obs.wave.heightMeters));
  assert.ok(
    obs.wave.heightMeters >= 0 && obs.wave.heightMeters <= 30,
    `Wave height ${obs.wave.heightMeters}m within physical limit [0, 30]`
  );

  assert.equal(typeof obs.wave.periodSeconds, 'number');
  assert.ok(obs.wave.periodSeconds >= 0 && obs.wave.periodSeconds <= 35);

  assert.equal(typeof obs.seaSurfaceTemperatureCelsius, 'number');
  assert.ok(!isNaN(obs.seaSurfaceTemperatureCelsius));
  assert.ok(
    obs.seaSurfaceTemperatureCelsius >= -2 && obs.seaSurfaceTemperatureCelsius <= 45,
    `SST ${obs.seaSurfaceTemperatureCelsius}°C within global ocean bounds [-2, 45]`
  );

  assert.equal(typeof obs.wind.speedKmh, 'number');
  assert.ok(
    obs.wind.speedKmh >= 0 && obs.wind.speedKmh <= 350,
    `Wind speed ${obs.wind.speedKmh} km/h within earthly atmospheric limits [0, 350]`
  );

  assert.equal(typeof obs.currents.velocityKmh, 'number');
  assert.ok(obs.currents.velocityKmh >= 0 && obs.currents.velocityKmh <= 25);

  assert.equal(typeof obs.isSafeForSmallCraft, 'boolean');
  assert.ok(obs.advisoryText.length > 10, 'Advisory text should be meaningful');
});

test('NASA GIBS layer configuration and WMS URL generation', () => {
  const sstLayer = SATELLITE_LAYERS.sst;
  assert.equal(sstLayer.id, 'sst');
  assert.equal(sstLayer.layerType, 'satellite-derived layer');
  assert.ok(sstLayer.wmsLayerName);

  const wmsUrl = buildGibsWmsUrl(sstLayer.wmsLayerName, '2026-09-28');
  assert.ok(wmsUrl.includes('SERVICE=WMS'));
  assert.ok(wmsUrl.includes('VERSION=1.3.0'));
  assert.ok(wmsUrl.includes('LAYERS=GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature'));
  assert.ok(wmsUrl.includes('{bbox-epsg-3857}'));
});
