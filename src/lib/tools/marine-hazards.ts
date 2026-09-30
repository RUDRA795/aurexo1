import { MarineHazardAlert, GeoCoordinate } from '../types/domain';
import { getAlertService } from '../services/alert.service';
import { MarineAlert } from '../domain/models';

function toMarineHazardAlert(a: MarineAlert): MarineHazardAlert {
  return {
    id: a.id,
    severity: a.severity,
    hazardType: a.hazardType,
    affectedRegion: a.affectedRegion,
    headline: a.headline,
    description: a.description,
    issuedAt: a.issuedAt,
    validUntil: a.validUntil,
    recommendedAction: a.recommendedAction,
    status: a.provenance.verificationStatus,
    source: a.provenance.provider,
  };
}

/**
 * Delegating tool facade for AlertService.
 * Ensures backward compatibility while routing all calls through the canonical AlertService.
 */
export async function getMarineHazards(
  coordinate: GeoCoordinate,
  regionName: string = 'Regional Maritime Sector'
): Promise<MarineHazardAlert[]> {
  const service = getAlertService();
  const alerts = await service.evaluateMarineAlerts(coordinate, regionName);
  return alerts.map(toMarineHazardAlert);
}
