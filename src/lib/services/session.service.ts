import { SessionState, GeoCoordinate } from '../domain/models';

export class SessionService {
  private sessions = new Map<string, SessionState>();
  private readonly defaultTtlMs = 60 * 60 * 1000; // 1 hour session lifetime

  getSession(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionState, 'sessionId' | 'updatedAt'>>
  ): SessionState {
    const existing = this.sessions.get(sessionId) ?? {
      sessionId,
      updatedAt: new Date().toISOString(),
    };

    const updated: SessionState = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updated);
    return updated;
  }

  resolveSessionContext(
    incomingContext?: {
      lastLocationName?: string;
      lastCoordinates?: GeoCoordinate;
      lastActiveLayer?: string;
    },
    sessionId?: string
  ): SessionState {
    if (sessionId) {
      const serverSession = this.sessions.get(sessionId);
      if (serverSession) {
        return {
          ...serverSession,
          ...incomingContext,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    return {
      sessionId: sessionId ?? `SESSION-${Date.now()}`,
      lastCoordinates: incomingContext?.lastCoordinates,
      lastLocationName: incomingContext?.lastLocationName,
      lastActiveLayer: incomingContext?.lastActiveLayer,
      updatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
const GLOBAL_SESSION_SERVICE_KEY = '__aurexo_session_service__';
export function getSessionService(): SessionService {
  const g = globalThis as unknown as Record<string, SessionService | undefined>;
  if (!g[GLOBAL_SESSION_SERVICE_KEY]) {
    g[GLOBAL_SESSION_SERVICE_KEY] = new SessionService();
  }
  return g[GLOBAL_SESSION_SERVICE_KEY]!;
}
