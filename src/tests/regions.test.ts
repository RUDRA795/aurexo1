import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllRegions, findRegionByName, scanActiveRegionalWarnings } from '../lib/tools/regions';

test('getAllRegions returns all 9 official Indian coastal maritime sectors', () => {
  const regions = getAllRegions();
  assert.equal(regions.length, 9);

  const regionIds = regions.map((r) => r.id);
  assert.ok(regionIds.includes('saurashtra_kutch'));
  assert.ok(regionIds.includes('konkan'));
  assert.ok(regionIds.includes('goa_karavali'));
  assert.ok(regionIds.includes('malabar'));
  assert.ok(regionIds.includes('palk_gulf_mannar'));
  assert.ok(regionIds.includes('coromandel'));
  assert.ok(regionIds.includes('andhra_coast'));
  assert.ok(regionIds.includes('utkal_bengal'));
  assert.ok(regionIds.includes('island_territories'));
});

test('findRegionByName correctly matches direct names and coastal aliases', () => {
  const mumbaiMatch = findRegionByName('What is the weather around Mumbai?');
  assert.ok(mumbaiMatch);
  assert.equal(mumbaiMatch.id, 'konkan');

  const kochiMatch = findRegionByName('Show warnings for Kochi harbor');
  assert.ok(kochiMatch);
  assert.equal(kochiMatch.id, 'malabar');

  const vizagMatch = findRegionByName('Conditions in Visakhapatnam waters');
  assert.ok(vizagMatch);
  assert.equal(vizagMatch.id, 'andhra_coast');

  const noMatch = findRegionByName('Show conditions in the Mediterranean');
  assert.equal(noMatch, null);
});

test('scanActiveRegionalWarnings computes verified regional sea states', async () => {
  const states = await scanActiveRegionalWarnings();
  assert.equal(states.length, 9);

  for (const s of states) {
    assert.ok(s.regionId);
    assert.ok(s.regionName);
    assert.equal(typeof s.activeWarningsCount, 'number');
    assert.equal(typeof s.isSeaRough, 'boolean');
    assert.ok(s.safetySummary.length > 0);
    if (s.representativeObservation) {
      assert.equal(typeof s.representativeObservation.waveHeightMeters, 'number');
      assert.equal(typeof s.representativeObservation.windSpeedKmh, 'number');
      assert.equal(typeof s.representativeObservation.sstCelsius, 'number');
    }
  }
});
