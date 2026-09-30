import { NextRequest, NextResponse } from 'next/server';
import { missionOrchestrator } from '@/lib/agents/supervisor';
import { getSessionService } from '@/lib/services/session.service';
import { GeoCoordinate, SessionContext, SatelliteLayerId } from '@/lib/types/domain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = body.prompt;
    const coordinate: GeoCoordinate | undefined = body.coordinate;
    const conversationHistory = body.conversationHistory ?? [];
    const sessionContext: SessionContext = body.sessionContext ?? {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'A valid non-empty prompt string is required' },
        { status: 400 }
      );
    }

    const sessionService = getSessionService();
    const resolvedSession = sessionService.resolveSessionContext(sessionContext);

    const result = await missionOrchestrator.dispatch({
      prompt: prompt.trim(),
      userCoordinates: coordinate,
      conversationHistory,
      sessionContext: {
        lastCoordinates: resolvedSession.lastCoordinates,
        lastLocationName: resolvedSession.lastLocationName,
        lastActiveLayer: resolvedSession.lastActiveLayer as SatelliteLayerId | undefined,
      },
    });

    if (result.sessionContext && resolvedSession.sessionId) {
      sessionService.updateSession(resolvedSession.sessionId, {
        lastCoordinates: result.sessionContext.lastCoordinates,
        lastLocationName: result.sessionContext.lastLocationName,
        lastActiveLayer: result.sessionContext.lastActiveLayer,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/agent/query:', error);
    return NextResponse.json(
      {
        error: 'Failed to process agent query',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
