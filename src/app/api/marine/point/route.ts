import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPointIntelligenceService } from '@/lib/services/point-intelligence.service';

const PointQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawLat = searchParams.get('lat');
    const rawLon = searchParams.get('lon');

    const parsed = PointQuerySchema.safeParse({ lat: rawLat, lon: rawLon });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid coordinates provided. lat must be between -90 and 90, lon between -180 and 180.',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const coordinate = {
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
    };

    const pointService = getPointIntelligenceService();
    const result = await pointService.getPointIntelligence(coordinate);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error in /api/marine/point:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve point intelligence',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
