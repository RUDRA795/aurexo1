import { GeoCoordinate, MarineAlert, MarineObservation } from '../domain/models';
import { getMarineService } from './marine.service';
import { ImdAdapter } from '../providers/imd';

export class AlertService {
  private marineService = getMarineService();
  private imdAdapter = new ImdAdapter();

  async evaluateMarineAlerts(
    coordinate: GeoCoordinate,
    regionName: string = 'Regional Maritime Sector',
    existingObservation?: MarineObservation
  ): Promise<MarineAlert[]> {
    const alerts: MarineAlert[] = [];
    const obs = existingObservation ?? (await this.marineService.getMarineObservation(coordinate, regionName));

    const waveHeight = obs.wave.heightMeters;
    const windSpeed = obs.wind.speedKmh;
    const gusts = obs.wind.gustsKmh;
    const now = new Date();

    // 1. High Wave Alert Evaluation
    if (waveHeight >= 2.5) {
      alerts.push({
        id: `ALERT-WAVE-${now.getTime()}`,
        severity: waveHeight >= 4.0 ? 'Emergency' : 'Warning',
        hazardType: 'High Wave',
        affectedRegion: regionName,
        headline: `High Wave Alert: Significant wave heights of ${waveHeight.toFixed(1)}m observed`,
        description: `Rough sea conditions observed with wave period of ${obs.wave.periodSeconds.toFixed(1)}s. Small fishing vessels and artisanal craft should remain in port.`,
        issuedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
        recommendedAction: 'Suspend nearshore artisanal fishing and small-craft navigation.',
        provenance: {
          provider: 'ORCA Oceanographic Threat Engine (Open-Meteo live feed)',
          endpoint: 'https://marine-api.open-meteo.com',
          retrievalTimestamp: now.toISOString(),
          observationTimestamp: obs.provenance.observationTimestamp,
          verificationStatus: 'VERIFIED_LIVE',
        },
      });
    }

    // 2. Squall / Gale Wind Alert Evaluation
    if (gusts >= 45 || windSpeed >= 38) {
      alerts.push({
        id: `ALERT-WIND-${now.getTime()}`,
        severity: gusts >= 65 ? 'Warning' : 'Watch',
        hazardType: 'Squall',
        affectedRegion: regionName,
        headline: `Squally Weather Bulletin: Sustained winds ${windSpeed.toFixed(1)} km/h gusting to ${gusts.toFixed(1)} km/h`,
        description: `Atmospheric turbulence and gale squalls observed. Beaufort scale ${obs.wind.beaufortScale} (${obs.wind.beaufortDescription}).`,
        issuedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + 18 * 3600 * 1000).toISOString(),
        recommendedAction: 'Vessels at sea advised to hoist storm warning flags and navigate towards sheltered embayments.',
        provenance: {
          provider: 'ORCA Atmospheric Threat Engine (Open-Meteo live feed)',
          endpoint: 'https://api.open-meteo.com',
          retrievalTimestamp: now.toISOString(),
          observationTimestamp: obs.provenance.observationTimestamp,
          verificationStatus: 'VERIFIED_LIVE',
        },
      });
    }

    // 3. Honest IMD Programmatic Feed Status
    alerts.push(this.imdAdapter.getProgrammaticFeedStatus(regionName));

    return alerts;
  }
}

// Singleton instance
const GLOBAL_ALERT_SERVICE_KEY = '__orca_alert_service__';
export function getAlertService(): AlertService {
  const g = globalThis as unknown as Record<string, AlertService | undefined>;
  if (!g[GLOBAL_ALERT_SERVICE_KEY]) {
    g[GLOBAL_ALERT_SERVICE_KEY] = new AlertService();
  }
  return g[GLOBAL_ALERT_SERVICE_KEY]!;
}
