import { MarineAlert, DataProvenance } from '../domain/models';

export class ImdAdapter {
  /**
   * Evaluates the availability of direct programmatic IMD cyclone feeds.
   * Public unauthenticated JSON feeds return 404/403 and are unavailable without MoES credentials.
   * Returns an honest UNAVAILABLE advisory instead of faking bulletins.
   */
  getProgrammaticFeedStatus(regionName: string): MarineAlert {
    const provenance: DataProvenance = {
      provider: 'India Meteorological Department (IMD)',
      endpoint: 'https://mausam.imd.gov.in',
      retrievalTimestamp: new Date().toISOString(),
      observationTimestamp: new Date().toISOString(),
      verificationStatus: 'UNAVAILABLE',
    };

    return {
      id: `IMD-FEED-NOTICE-${Date.now()}`,
      severity: 'Advisory',
      hazardType: 'Rough Sea',
      affectedRegion: `${regionName} (Indian Maritime Waters)`,
      headline: 'IMD Programmatic Feed: UNAVAILABLE (Direct API Credentials Required)',
      description:
        'Direct automated JSON endpoints for IMD cyclone bulletins require MoES institutional credentials. Live dynamic marine hazards in ORCA are derived strictly from verified Open-Meteo physical wind/wave thresholds.',
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      recommendedAction:
        'Cross-reference local port warning signals (1 to 11) via coastal VHF marine radio or NAVTEX.',
      provenance,
    };
  }
}
