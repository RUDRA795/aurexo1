import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGeofence } from '../lib/geo/boundaries';
import { computeSafePassage } from '../lib/geo/routes';

test('checkGeofence accurately detects Gulf of Mannar Marine Protected Area', () => {
  // Coordinate inside Gulf of Mannar Marine National Park polygon [79.0, 9.0]
  const coord = { latitude: 9.05, longitude: 79.00 };
  const res = checkGeofence(coord);

  assert.equal(res.isInsideMarineProtectedArea, true);
  assert.equal(res.riskStatus, 'Restricted Zone Violation');
  assert.ok(res.protectedAreaName?.includes('Gulf of Mannar'));
});

test('checkGeofence triggers proximity warning near Pakistan IMBL', () => {
  // Coordinate close to Sir Creek seaward extension (Pakistan border)
  const coord = { latitude: 23.55, longitude: 68.05 };
  const res = checkGeofence(coord);

  assert.equal(res.nearestNeighborCountry, 'Pakistan');
  assert.ok(res.distanceToIMBLKm < 50, `Distance ${res.distanceToIMBLKm}km should be within alert zone`);
  assert.ok(
    res.riskStatus === 'Caution' || res.riskStatus === 'Border Proximity Warning',
    `Risk status should be Caution or Border Proximity Warning, got ${res.riskStatus}`
  );
});

test('computeSafePassage produces valid waypoint corridor and distance', () => {
  const origin = { latitude: 18.95, longitude: 72.80 }; // Mumbai
  const dest = { latitude: 18.60, longitude: 72.95 }; // South along Konkan

  const plan = computeSafePassage(origin, dest, 22);

  assert.ok(plan.totalDistanceKm > 30 && plan.totalDistanceKm < 60);
  assert.ok(plan.estimatedTravelTimeHours > 1 && plan.estimatedTravelTimeHours < 4);
  assert.equal(plan.waypoints.length, 6); // origin + 4 intermediates + destination
  assert.equal(plan.routeGeometry.type, 'LineString');
  assert.equal(plan.routeGeometry.coordinates.length, 6);
  assert.ok(plan.overallSafety === 'Safe' || plan.overallSafety === 'Caution');
});
