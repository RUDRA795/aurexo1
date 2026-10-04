/**
 * Canonical typed provider error taxonomy for ORCA.
 * Ensures external failures degrade honestly and predictably.
 */

export type ProviderErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'INVALID_RESPONSE'
  | 'PROVIDER_UNAVAILABLE'
  | 'DATA_STALE'
  | 'UNSUPPORTED';

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    public readonly provider: string,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(`[${provider}] ${code}: ${message}`);
    this.name = 'ProviderError';
  }
}
