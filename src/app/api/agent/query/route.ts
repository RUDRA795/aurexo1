import { NextRequest, NextResponse } from 'next/server';
import { runSupervisorAgent } from '@/lib/agents/supervisor';
import { GeoCoordinate, SessionContext } from '@/lib/types/domain';

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

    const result = await runSupervisorAgent({
      prompt: prompt.trim(),
      userCoordinates: coordinate,
      conversationHistory,
      sessionContext,
    });

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
