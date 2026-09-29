import { MarineHazardAlert, GeoCoordinate } from '../types/domain';
import { fetchMarineConditions } from './marine-conditions';

/**
 * Assesses marine hazards for a specified maritime region or coordinate.
 * Combines verified live atmospheric observations with structured IMD alert standards.
 */
export async function getMarineHazards(
  coordinate: GeoCoordinate,
  regionName: string = 'Regional Maritime Sector'
): Promise<MarineHazardAlert[]> {
  const alerts: MarineHazardAlert[] = [];

  try {
    const conditions = await fetchMarineConditions(coordinate, regionName);
    const wave = conditions.wave.heightMeters;
    const wind = conditions.wind.speedKmh;
    const gusts = conditions.wind.gustsKmh;

    // High Wave Alert evaluation (threshold: 2.5m)
    if (wave >= 2.5) {
      alerts.push({
        id: `HAZ-WAVE-${Date.now()}`,
        severity: wave >= 4.0 ? 'Emergency' : 'Warning',
        hazardType: 'High Wave',
        affectedRegion: regionName,
        headline: `High Wave Alert: Significant wave heights of ${wave.toFixed(1)}m observed`,
        description: `Rough sea conditions observed with wave period of ${conditions.wave.periodSeconds.toFixed(1)}s. Small fishing vessels and traditional non-motorized craft should remain in harbour.`,
        issuedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        recommendedAction: 'Suspend nearshore recreational and small-scale artisanal fishing activities.',
        status: 'VERIFIED_LIVE',
        source: 'Aurexo Oceanographic Threat Engine (Open-Meteo live feed)',
      });
    }

    // Squall / Gale Wind Alert evaluation (threshold: 45 km/h gusts)
    if (gusts >= 45 || wind >= 38) {
      alerts.push({
        id: `HAZ-WIND-${Date.now()}`,
        severity: gusts >= 65 ? 'Warning' : 'Watch',
        hazardType: 'Squall',
        affectedRegion: regionName,
        headline: `Squally Weather Bulletin: Sustained winds ${wind.toFixed(1)} km/h gusting to ${gusts.toFixed(1)} km/h`,
        description: `Strong squall lines with atmospheric turbulence observed. Beaufort force ${conditions.wind.beaufortScale} (${conditions.wind.beaufortDescription}).`,
        issuedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
        recommendedAction: 'Vessels at sea advised to hoist storm signal and head towards sheltered coastal embayments.',
        status: 'VERIFIED_LIVE',
        source: 'Aurexo Atmospheric Threat Engine (Open-Meteo live feed)',
      });
    }

    // Reference IMD Coastal Advisory
    alerts.push({
      id: `REF-IMD-ADV-${Date.now()}`,
      severity: 'Advisory',
      hazardType: 'Rough Sea',
      affectedRegion: `${regionName} (Indian Coastal Waters)`,
      headline: 'IMD Routine Marine Meteorological Advisory',
      description: 'Standard monsoon/post-monsoon coastal surveillance in effect. Cross-reference with daily local port signals and NAVTEX transmissions.',
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      recommendedAction: 'Carry functional life-jackets, VHF transceivers, and emergency position indicating radio beacons (EPIRBs).',
      status: 'DOCUMENTED_UNVERIFIED',
      source: 'India Meteorological Department (Reference guidelines)',
    });
  } catch (error) {
    console.error('Error fetching marine conditions for hazard assessment:', error);
  }

  return alerts;
}
