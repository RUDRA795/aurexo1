import { PFZAdvisoryResult } from '../types/domain';

/**
 * Adapter for INCOIS Potential Fishing Zones (PFZ).
 * Status: DOCUMENTED_UNVERIFIED.
 * In accordance with ORCA data principles, if the official INCOIS live API feed
 * is unverified today, we return structured reference sector guidelines and clearly
 * flag the source as DOCUMENTED_UNVERIFIED so users know it is not live sensor telemetry.
 */
export async function getPFZAdvisories(region: string = 'all'): Promise<PFZAdvisoryResult> {
  const normRegion = region.toLowerCase();

  const referenceZones = [
    {
      id: 'PFZ-GUJ-01',
      name: 'Porbandar - Veraval Deep Sea Front',
      coordinates: { latitude: 21.20, longitude: 69.20 },
      distanceFromCoastKm: 38,
      targetSpecies: ['Yellowfin Tuna', 'Ribbonfish', 'Indian Mackerel'],
      depthMeters: 65,
      chlorophyllStatus: 'Moderate chlorophyll gradient (0.4 - 0.8 mg/m³)',
    },
    {
      id: 'PFZ-MAH-01',
      name: 'Mumbai - Alibaug Outer Continental Shelf',
      coordinates: { latitude: 18.80, longitude: 72.40 },
      distanceFromCoastKm: 42,
      targetSpecies: ['Silver Pomfret', 'Seer Fish', 'Bombay Duck'],
      depthMeters: 55,
      chlorophyllStatus: 'Elevated ocean color front observed along thermal break',
    },
    {
      id: 'PFZ-KER-01',
      name: 'Kochi - Alleppey Upwelling Sector',
      coordinates: { latitude: 9.80, longitude: 75.80 },
      distanceFromCoastKm: 28,
      targetSpecies: ['Indian Oil Sardine', 'Horse Mackerel', 'Squid'],
      depthMeters: 45,
      chlorophyllStatus: 'Strong coastal upwelling signature',
    },
    {
      id: 'PFZ-TN-01',
      name: 'Coromandel Central (Pondicherry - Nagapattinam)',
      coordinates: { latitude: 11.50, longitude: 80.20 },
      distanceFromCoastKm: 32,
      targetSpecies: ['Tuna', 'Carangids', 'Snappers'],
      depthMeters: 60,
      chlorophyllStatus: 'Ocean thermal front intersecting 50m isobath',
    },
  ];

  let filtered = referenceZones;
  if (normRegion !== 'all') {
    filtered = referenceZones.filter(
      (z) =>
        z.name.toLowerCase().includes(normRegion) ||
        z.id.toLowerCase().includes(normRegion)
    );
    if (filtered.length === 0) filtered = referenceZones;
  }

  return {
    sector: region,
    status: 'DOCUMENTED_UNVERIFIED',
    message:
      'PFZ information derived from INCOIS oceanographic guidelines. Live daily INCOIS server feed is in DOCUMENTED_UNVERIFIED status; verify with coastal radio before departure.',
    zones: filtered,
  };
}
