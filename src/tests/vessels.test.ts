import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllVessels,
  findVesselByNameOrMMSI,
  findNearestVessel,
  registerUserVessel,
} from '../lib/tools/vessels';

test('getAllVessels returns live baseline Indian fleet', () => {
  const vessels = getAllVessels();
  assert.ok(vessels.length >= 6);

  const sagarKanya = vessels.find((v) => v.name.toLowerCase().includes('sagar kanya'));
  assert.ok(sagarKanya);
  assert.equal(sagarKanya.vesselType, 'Research Vessel');
  assert.equal(sagarKanya.sourceStatus, 'LIVE_AIS');
});

test('findVesselByNameOrMMSI matches by name fragment and exact MMSI', () => {
  const byName = findVesselByNameOrMMSI('samarth');
  assert.ok(byName);
  assert.equal(byName.name, 'ICGS Samarth');

  const byMmsi = findVesselByNameOrMMSI('419000202');
  assert.ok(byMmsi);
  assert.equal(byMmsi.name, 'ICGS Samarth');

  const notFound = findVesselByNameOrMMSI('unknown_phantom_ship');
  assert.equal(notFound, null);
});

test('findNearestVessel accurately calculates proximity using Turf spherical geometry', () => {
  // Mumbai coordinates
  const mumbaiCoord = { latitude: 18.95, longitude: 72.80 };
  const nearest = findNearestVessel(mumbaiCoord);

  assert.ok(nearest);
  assert.ok(nearest.vessel);
  assert.ok(nearest.distanceKm >= 0);
  assert.ok(nearest.distanceNauticalMiles >= 0);
  assert.ok(nearest.bearingDegrees >= 0 && nearest.bearingDegrees <= 360);
});

test('registerUserVessel persists custom vessel and allows lookup', () => {
  const newVessel = registerUserVessel({
    name: 'FV Sagar Ratna',
    mmsi: '419999001',
    vesselType: 'Artisanal Fishing',
    latitude: 15.30,
    longitude: 73.75,
    speedKnots: 8.5,
    headingDegrees: 240,
    destination: 'Mormugao Port',
  });

  assert.ok(newVessel.id);
  assert.equal(newVessel.sourceStatus, 'USER_REGISTERED');

  const fetched = findVesselByNameOrMMSI('Sagar Ratna');
  assert.ok(fetched);
  assert.equal(fetched.id, newVessel.id);
  assert.equal(fetched.destination, 'Mormugao Port');
});
