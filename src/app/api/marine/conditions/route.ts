import { NextRequest, NextResponse } from 'next/server';
import { fetchMarineConditions } from '@/lib/tools/marine-conditions';
import { GeoCoordinate } from '@/lib/types/domain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');
    const locationName = searchParams.get('name') ?? 'Selected Coordinate';

    if (!latStr || !lonStr) {
      return NextResponse.json(
        { error: 'Missing lat or lon query parameters' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid numeric coordinate parameters' },
        { status: 400 }
      );
    }

    // Physical coordinate bounds
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Coordinates out of geographical bounds' },
        { status: 400 }
      );
    }

    const coordinate: GeoCoordinate = { latitude, longitude };
    const conditions = await fetchMarineConditions(coordinate, locationName);

    return NextResponse.json(conditions);
  } catch (error) {
    console.error('Error in /api/marine/conditions:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve marine conditions',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
