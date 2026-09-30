import { PFZAdvisory } from '../domain/models';
import { IncoisAdapter } from '../providers/incois';

export class PFZService {
  private incoisAdapter = new IncoisAdapter();

  getAdvisory(sectorName: string): PFZAdvisory {
    return this.incoisAdapter.getPfzAdvisoryForSector(sectorName);
  }

  /**
   * Computes deterministic Habitat Suitability Index (0-100)
   * Grounded in empirical Indian Ocean pelagic thermal bands:
   * Optimum tuna/sardine range: 26.5°C to 29.5°C.
   */
  calculateHabitatSuitabilityScore(seaSurfaceTemperatureCelsius: number): number {
    const temp = seaSurfaceTemperatureCelsius;
    let score = 50;

    if (temp >= 26.5 && temp <= 29.5) {
      // Optimal upwelling thermal boundary
      score = 85 + Math.round((1 - Math.abs(temp - 28.0) / 1.5) * 10);
    } else if (temp > 29.5 && temp <= 31.0) {
      score = 65;
    } else if (temp < 26.5 && temp >= 24.0) {
      score = 70;
    } else {
      score = 35; // thermal stress band
    }

    return Math.min(100, Math.max(0, score));
  }
}

// Singleton instance
const GLOBAL_PFZ_SERVICE_KEY = '__aurexo_pfz_service__';
export function getPfzService(): PFZService {
  const g = globalThis as unknown as Record<string, PFZService | undefined>;
  if (!g[GLOBAL_PFZ_SERVICE_KEY]) {
    g[GLOBAL_PFZ_SERVICE_KEY] = new PFZService();
  }
  return g[GLOBAL_PFZ_SERVICE_KEY]!;
}
