import { GeoCoordinate, MarineObservation } from '../types/domain';
import { getMarineService } from '../services/marine.service';
export { getBeaufortScale, getWaveCategory } from '../providers/open-meteo';

/**
 * Delegating tool facade for MarineService.
 * Ensures backward compatibility while routing all calls through the canonical MarineService.
 */
export async function fetchMarineConditions(
  coordinate: GeoCoordinate,
  locationName: string = 'Offshore Point'
): Promise<MarineObservation> {
  const service = getMarineService();
  return (await service.getMarineObservation(coordinate, locationName)) as unknown as MarineObservation;
}
