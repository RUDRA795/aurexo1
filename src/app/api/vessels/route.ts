import { NextRequest, NextResponse } from 'next/server';
import {
  getAllVessels,
  getFleetAisTelemetry,
  findVesselByNameOrMMSI,
  findNearestVessel,
  registerUserVessel,
  RegisterVesselSchema,
} from '@/lib/tools/vessels';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const nearLatStr = searchParams.get('nearLat');
    const nearLonStr = searchParams.get('nearLon');

    if (query) {
      const match = findVesselByNameOrMMSI(query);
      if (!match) {
        return NextResponse.json({ error: `Vessel not found matching: ${query}` }, { status: 404 });
      }
      return NextResponse.json(match);
    }

    if (nearLatStr && nearLonStr) {
      const nearLat = parseFloat(nearLatStr);
      const nearLon = parseFloat(nearLonStr);
      if (isNaN(nearLat) || isNaN(nearLon)) {
        return NextResponse.json({ error: 'Invalid numeric nearLat or nearLon coordinates' }, { status: 400 });
      }

      const nearest = findNearestVessel({ latitude: nearLat, longitude: nearLon });
      if (!nearest) {
        return NextResponse.json({ error: 'No vessels in active registry' }, { status: 404 });
      }
      return NextResponse.json(nearest);
    }

    const fleet = getAllVessels();
    const aisTelemetry = getFleetAisTelemetry();
    return NextResponse.json({ count: fleet.length, fleet, aisTelemetry });
  } catch (error) {
    console.error('Error in /api/vessels GET:', error);
    return NextResponse.json({ error: 'Failed to retrieve vessels', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = RegisterVesselSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid vessel registration payload', validationErrors: parsed.error.format() },
        { status: 400 }
      );
    }

    const registered = registerUserVessel(parsed.data);
    return NextResponse.json(registered, { status: 201 });
  } catch (error) {
    console.error('Error in /api/vessels POST:', error);
    return NextResponse.json({ error: 'Failed to register vessel', details: String(error) }, { status: 500 });
  }
}
