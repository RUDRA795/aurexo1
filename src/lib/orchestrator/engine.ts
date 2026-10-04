import { AgentResponse, GeoCoordinate, SatelliteLayerId, AgentEvidenceSource } from '../types/domain';
import { TOOLS } from '../tools/registry';
import { synthesizeMarineResponse } from '../llm/provider';

// Known Indian coastal reference points for natural language geolocation
const COASTAL_LOCATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  mumbai: { lat: 18.95, lon: 72.80, name: 'Mumbai Offshore' },
  porbandar: { lat: 21.64, lon: 69.60, name: 'Porbandar Offshore (Gujarat)' },
  veraval: { lat: 20.90, lon: 70.36, name: 'Veraval Coastal Sector (Gujarat)' },
  kutch: { lat: 22.50, lon: 69.50, name: 'Gulf of Kutch' },
  goa: { lat: 15.49, lon: 73.80, name: 'Goa Coast' },
  kochi: { lat: 9.93, lon: 76.25, name: 'Kochi Offshore (Kerala)' },
  rameswaram: { lat: 9.28, lon: 79.31, name: 'Rameswaram (Palk Bay / Sri Lanka border)' },
  tuticorin: { lat: 8.76, lon: 78.13, name: 'Tuticorin Coast (Gulf of Mannar)' },
  chennai: { lat: 13.08, lon: 80.27, name: 'Chennai Offshore (Coromandel Coast)' },
  visakhapatnam: { lat: 17.68, lon: 83.21, name: 'Visakhapatnam (Bay of Bengal)' },
  paradeep: { lat: 20.31, lon: 86.61, name: 'Paradeep Coast (Odisha)' },
};

function extractLocationFromPrompt(prompt: string): { coord: GeoCoordinate; name: string } | null {
  const lower = prompt.toLowerCase();
  for (const [key, loc] of Object.entries(COASTAL_LOCATIONS)) {
    if (lower.includes(key)) {
      return { coord: { latitude: loc.lat, longitude: loc.lon }, name: loc.name };
    }
  }
  return null;
}

export async function processAgentQuery(
  userPrompt: string,
  userCoordinate?: GeoCoordinate
): Promise<AgentResponse> {
  const promptLower = userPrompt.toLowerCase();
  const toolsUsed: string[] = [];
  const evidenceSources: AgentEvidenceSource[] = [];
  const toolData: Record<string, any> = {};

  // 1. Resolve Location
  const extracted = extractLocationFromPrompt(userPrompt);
  const targetCoord: GeoCoordinate =
    extracted?.coord ??
    userCoordinate ?? { latitude: 18.95, longitude: 72.80 }; // Default to Mumbai offshore if unstated
  const locationName = extracted?.name ?? (userCoordinate ? 'Current Vessel Coordinate' : 'Mumbai Offshore');

  // Determine Map Camera Action Defaults
  let mapCenter: [number, number] = [targetCoord.longitude, targetCoord.latitude];
  let mapZoom = 8;
  let activeLayer: SatelliteLayerId = 'none';
  let highlightGeometry: GeoJSON.Geometry | undefined = undefined;

  // 2. Identify and execute deterministic tools based on intent

  // Intent A: Marine Conditions / Wave / Wind / Sea State
  const wantsConditions =
    promptLower.includes('condition') ||
    promptLower.includes('wave') ||
    promptLower.includes('wind') ||
    promptLower.includes('sea state') ||
    promptLower.includes('swell') ||
    promptLower.includes('current') ||
    promptLower.includes('weather') ||
    promptLower.includes('safe') ||
    promptLower.includes('sail');

  // Intent B: Sea Surface Temperature (SST)
  const wantsSST =
    promptLower.includes('sst') ||
    promptLower.includes('temperature') ||
    promptLower.includes('thermal') ||
    promptLower.includes('heat');

  // Intent C: Chlorophyll / Ocean Color / Bloom
  const wantsChlorophyll =
    promptLower.includes('chlorophyll') ||
    promptLower.includes('ocean color') ||
    promptLower.includes('algal') ||
    promptLower.includes('bloom');

  // Intent D: Geofence / Borders / IMBL / International waters / MPAs
  const wantsBoundaries =
    promptLower.includes('border') ||
    promptLower.includes('imbl') ||
    promptLower.includes('pakistan') ||
    promptLower.includes('sri lanka') ||
    promptLower.includes('eez') ||
    promptLower.includes('protected') ||
    promptLower.includes('reserve') ||
    promptLower.includes('mpa');

  // Intent E: Potential Fishing Zones (PFZ) / Fish catch
  const wantsPFZ =
    promptLower.includes('pfz') ||
    promptLower.includes('fish') ||
    promptLower.includes('tuna') ||
    promptLower.includes('catch') ||
    promptLower.includes('zone');

  // Intent F: Safe Passage / Route Planning
  const wantsRoute =
    promptLower.includes('route') ||
    promptLower.includes('passage') ||
    promptLower.includes('travel') ||
    promptLower.includes('corridor') ||
    promptLower.includes('waypoint');

  // Intent G: Satellite Layer Toggle
  if (wantsSST) activeLayer = 'sst';
  if (wantsChlorophyll) activeLayer = 'chlorophyll';
  if (promptLower.includes('truecolor') || promptLower.includes('satellite image')) activeLayer = 'truecolor';

  // Execute Tool 1: Marine Conditions
  if (wantsConditions || wantsSST || (!wantsPFZ && !wantsRoute && !wantsBoundaries)) {
    toolsUsed.push('get_marine_conditions');
    try {
      const conditions = await TOOLS.get_marine_conditions.execute({
        latitude: targetCoord.latitude,
        longitude: targetCoord.longitude,
        locationName,
      });
      toolData.conditions = conditions;
      evidenceSources.push({
        name: 'Open-Meteo Marine & Atmospheric Reanalysis',
        status: 'VERIFIED_LIVE',
        retrievedAt: conditions.retrievedAt,
        observationTime: conditions.observationTime,
      });
    } catch (err) {
      console.error('Error fetching marine conditions:', err);
    }
  }

  // Execute Tool 2: Geofence & Boundary Sentinel
  if (wantsBoundaries || wantsRoute || promptLower.includes('safe') || promptLower.includes('sri lanka') || promptLower.includes('pakistan')) {
    toolsUsed.push('check_geofence_and_boundaries');
    try {
      const geofence = await TOOLS.check_geofence_and_boundaries.execute({
        latitude: targetCoord.latitude,
        longitude: targetCoord.longitude,
      });
      toolData.geofence = geofence;
      evidenceSources.push({
        name: 'Hydrographic Maritime Boundary Sentinel (EEZ/IMBL GeoJSON)',
        status: 'DOCUMENTED_UNVERIFIED',
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error checking geofence:', err);
    }
  }

  // Execute Tool 3: PFZ Advisories
  if (wantsPFZ) {
    toolsUsed.push('get_pfz_advisories');
    try {
      const pfz = await TOOLS.get_pfz_advisories.execute({ region: locationName });
      toolData.pfz = pfz;
      evidenceSources.push({
        name: 'INCOIS Potential Fishing Zones (PFZ Guidelines)',
        status: 'DOCUMENTED_UNVERIFIED',
        retrievedAt: new Date().toISOString(),
      });
      mapZoom = 7;
    } catch (err) {
      console.error('Error fetching PFZ:', err);
    }
  }

  // Execute Tool 4: Route Passage Corridor
  if (wantsRoute) {
    toolsUsed.push('compute_safe_passage');
    try {
      // Check if prompt specifies origin and destination
      const fromToMatch = promptLower.match(/(?:from|between)\s+([a-zA-Z\s]+?)\s+(?:to|and)\s+([a-zA-Z\s]+)/i);
      let originCoord: GeoCoordinate = targetCoord;
      let destCoord: GeoCoordinate = { latitude: targetCoord.latitude - 0.35, longitude: targetCoord.longitude + 0.28 };

      if (fromToMatch) {
        for (const [key, loc] of Object.entries(COASTAL_LOCATIONS)) {
          if (fromToMatch[1].includes(key)) originCoord = { latitude: loc.lat, longitude: loc.lon };
          if (fromToMatch[2].includes(key)) destCoord = { latitude: loc.lat, longitude: loc.lon };
        }
      }

      const route = await TOOLS.compute_safe_passage.execute({
        originLat: originCoord.latitude,
        originLon: originCoord.longitude,
        destLat: destCoord.latitude,
        destLon: destCoord.longitude,
      });
      toolData.route = route;
      highlightGeometry = route.routeGeometry;
      mapCenter = [(originCoord.longitude + destCoord.longitude) / 2, (originCoord.latitude + destCoord.latitude) / 2];
      mapZoom = route.totalDistanceKm > 300 ? 6 : 7;
      evidenceSources.push({
        name: 'ORCA Great-Circle Navigational Corridor Engine',
        status: 'VERIFIED_LIVE',
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error computing route:', err);
    }
  }

  // Execute Tool 5: Marine Hazards
  if (promptLower.includes('hazard') || promptLower.includes('warning') || promptLower.includes('cyclone') || promptLower.includes('storm')) {
    toolsUsed.push('get_marine_hazards');
    try {
      const hazards = await TOOLS.get_marine_hazards.execute({
        latitude: targetCoord.latitude,
        longitude: targetCoord.longitude,
        regionName: locationName,
      });
      toolData.hazards = hazards;
      evidenceSources.push({
        name: 'ORCA Threat Engine & IMD Marine Bulletins',
        status: 'DOCUMENTED_UNVERIFIED',
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error fetching hazards:', err);
    }
  }

  // Add NASA GIBS evidence if satellite layer is active
  if (activeLayer !== 'none') {
    toolsUsed.push('show_satellite_layer');
    evidenceSources.push({
      name: `NASA GIBS Satellite Layer (${activeLayer.toUpperCase()})`,
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
      observationTime: 'Daily composite observation',
    });
  }

  // 3. Synthesize explainable answer via prioritized LLM provider
  const llmResult = await synthesizeMarineResponse({
    userPrompt,
    intent: toolsUsed.join(' + ') || 'general_marine_inquiry',
    toolData,
  });

  return {
    answer: llmResult.text,
    intent: toolsUsed.join(' + ') || 'general_inquiry',
    toolsUsed,
    evidence: {
      sources: evidenceSources,
      measurements: toolData.conditions,
      geofence: toolData.geofence,
      timestamp: new Date().toISOString(),
    },
    mapActions: {
      center: mapCenter,
      zoom: mapZoom,
      activeLayer,
      highlightGeometry,
    },
    llmMetadata: {
      provider: llmResult.provider,
      model: llmResult.model,
      executionTimeMs: llmResult.executionTimeMs,
      escalated: llmResult.escalated,
    },
  };
}
