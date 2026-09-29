import { NextRequest, NextResponse } from 'next/server';
import { processAgentQuery } from '@/lib/orchestrator/engine';
import { GeoCoordinate } from '@/lib/types/domain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = body.prompt;
    const coordinate: GeoCoordinate | undefined = body.coordinate;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'A valid non-empty prompt string is required' },
        { status: 400 }
      );
    }

    const result = await processAgentQuery(prompt.trim(), coordinate);

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
