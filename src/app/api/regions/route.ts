import { NextRequest, NextResponse } from 'next/server';
import { getRegionService } from '@/lib/services/region.service';
import { scanActiveRegionalWarnings } from '@/lib/tools/regions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scan = searchParams.get('scan');
    const name = searchParams.get('name');
    const regionService = getRegionService();

    if (scan === 'warnings') {
      const states = await scanActiveRegionalWarnings();
      return NextResponse.json({
        retrievedAt: new Date().toISOString(),
        regions: states,
      });
    }

    if (name) {
      const region = regionService.findRegionByName(name);
      if (!region) {
        return NextResponse.json({ error: `Region not found: ${name}` }, { status: 404 });
      }
      return NextResponse.json(region);
    }

    const all = regionService.getAllRegions();
    return NextResponse.json({ count: all.length, regions: all });
  } catch (error) {
    console.error('Error in /api/regions:', error);
    return NextResponse.json(
      { error: 'Failed to process regions request', details: String(error) },
      { status: 500 }
    );
  }
}
