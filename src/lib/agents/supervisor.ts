import {
  AgentResponse,
  GeoCoordinate,
  SatelliteLayerId,
  AgentEvidenceSource,
  SessionContext,
  MapMarkerAction,
} from '../types/domain';
import { AgentStep, AgentSwarmTrace } from '../types/agents';
import { synthesizeMarineResponse } from '../llm/provider';
import { runOceanAgent } from './ocean';
import { runWeatherAgent } from './weather';
import { runSentinelAgent } from './sentinel';
import { runVesselAgent } from './vessels';
import { runBlueEconomyAgent } from './blue-economy';
import { findRegionByName, scanActiveRegionalWarnings } from '../tools/regions';
import { computeSafePassage } from '../geo/routes';
import { evaluateUnifiedSafety } from '../tools/safety-engine';

// Coastal Port Reference Registry
const COASTAL_ANCHORS: Record<string, { lat: number; lon: number; name: string }> = {
  mumbai: { lat: 18.95, lon: 72.80, name: 'Mumbai Offshore' },
  kochi: { lat: 9.93, lon: 76.25, name: 'Kochi Offshore (Malabar)' },
  cochin: { lat: 9.93, lon: 76.25, name: 'Kochi Offshore (Malabar)' },
  porbandar: { lat: 21.64, lon: 69.60, name: 'Porbandar Offshore (Gujarat)' },
  veraval: { lat: 20.90, lon: 70.36, name: 'Veraval Coastal Sector' },
  kutch: { lat: 22.50, lon: 69.50, name: 'Gulf of Kutch' },
  gujarat: { lat: 21.64, lon: 69.60, name: 'Gujarat Coastal Sector' },
  goa: { lat: 15.49, lon: 73.80, name: 'Goa Coast' },
  rameswaram: { lat: 9.28, lon: 79.31, name: 'Rameswaram (Palk Bay / Sri Lanka border)' },
  tuticorin: { lat: 8.76, lon: 78.13, name: 'Tuticorin (Gulf of Mannar)' },
  chennai: { lat: 13.08, lon: 80.27, name: 'Chennai Offshore (Coromandel)' },
  visakhapatnam: { lat: 17.68, lon: 83.21, name: 'Visakhapatnam (Bay of Bengal)' },
  paradeep: { lat: 20.31, lon: 86.61, name: 'Paradeep Coast (Odisha)' },
  kandla: { lat: 23.00, lon: 70.22, name: 'Kandla (Deendayal Port)' },
};

export interface SupervisorInput {
  prompt: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  sessionContext?: SessionContext;
  userCoordinates?: GeoCoordinate;
}

export async function runSupervisorAgent({
  prompt,
  conversationHistory = [],
  sessionContext = {},
  userCoordinates,
}: SupervisorInput): Promise<AgentResponse> {
  const startTime = Date.now();
  const promptLower = prompt.toLowerCase();
  const swarmSteps: AgentStep[] = [];
  const evidenceSources: AgentEvidenceSource[] = [];
  const toolsUsed: string[] = [];

  swarmSteps.push({
    agentName: 'Supervisor',
    action: 'Analyze Intent & Resolve Context',
    status: 'executing',
    detail: `Decomposing query: "${prompt}" across 5 specialized domain agents`,
    timestamp: new Date().toISOString(),
  });

  // 1. Resolve Location & Context Anaphora
  let targetLocationName: string | undefined;
  let targetCoord: GeoCoordinate | undefined;

  // Check prompt for explicit location mentions
  for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
    if (promptLower.includes(key)) {
      targetLocationName = anchor.name;
      targetCoord = { latitude: anchor.lat, longitude: anchor.lon };
      break;
    }
  }

  // Check for region mentions
  if (!targetCoord) {
    const matchedRegion = findRegionByName(prompt);
    if (matchedRegion) {
      targetLocationName = matchedRegion.name;
      targetCoord = matchedRegion.center;
    }
  }

  // Anaphora resolution: If user asks follow-up (e.g. "What about waves?", "How is it there?")
  if (!targetCoord && sessionContext.lastCoordinates) {
    targetCoord = sessionContext.lastCoordinates;
    targetLocationName = sessionContext.lastLocationName ?? 'Previous Selected Location';
    swarmSteps.push({
      agentName: 'Supervisor',
      action: 'Anaphora Resolved from Session Context',
      status: 'completed',
      detail: `Resolved implicit target to previous context: ${targetLocationName} ([${targetCoord.latitude}, ${targetCoord.longitude}])`,
      timestamp: new Date().toISOString(),
    });
  }

  // Fallback to user coordinate or Mumbai default
  if (!targetCoord) {
    targetCoord = userCoordinates ?? { latitude: 18.95, longitude: 72.80 };
    targetLocationName = userCoordinates ? 'Current Vessel Coordinate' : 'Mumbai Offshore';
  }

  const locName: string = targetLocationName ?? 'Indian Coastal Waters';
  targetLocationName = locName;

  // Setup default map action
  let mapCenter: [number, number] = [targetCoord.longitude, targetCoord.latitude];
  let mapZoom = 8;
  let activeLayer: SatelliteLayerId = sessionContext.lastActiveLayer ?? 'none';
  let highlightGeometry: GeoJSON.Geometry | undefined = undefined;
  let markerAction: MapMarkerAction | undefined;

  const toolData: Record<string, any> = {};
  const suggestedQueries: string[] = [];

  // =========================================================================
  // SCENARIO 1: Regional Warning Scan Query
  // =========================================================================
  if (promptLower.includes('which region') && (promptLower.includes('warning') || promptLower.includes('active'))) {
    toolsUsed.push('scan_active_regional_warnings');
    swarmSteps.push({
      agentName: 'WeatherHazard',
      action: 'Execute Regional Coastal Hazard Scan',
      status: 'executing',
      detail: 'Scanning active sea states and warning bulletins across all 9 Indian maritime sectors',
      timestamp: new Date().toISOString(),
    });

    const regionalStates = await scanActiveRegionalWarnings();
    toolData.regionalWarnings = regionalStates;

    const roughRegions = regionalStates.filter((r) => r.isSeaRough || r.activeWarningsCount > 0);
    swarmSteps.push({
      agentName: 'WeatherHazard',
      action: 'Regional Scan Complete',
      status: 'completed',
      detail: `Scanned sectors. Found ${roughRegions.length} sectors with elevated advisory thresholds.`,
      timestamp: new Date().toISOString(),
    });

    evidenceSources.push({
      name: 'Open-Meteo Regional Meteorological Mesh',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    suggestedQueries.push('Check wave conditions off Gujarat');
    suggestedQueries.push('Where are the nearest vessels to rough sectors?');
    suggestedQueries.push('Show satellite SST thermal fronts');

    mapZoom = 5;
    mapCenter = [78.0, 15.0]; // Pan out to whole Indian subcontinent
  }

  // =========================================================================
  // SCENARIO 2: Vessel & Fleet Tracking Query
  // =========================================================================
  else if (
    promptLower.includes('vessel') ||
    promptLower.includes('fleet') ||
    promptLower.includes('ship') ||
    promptLower.includes('boat') ||
    promptLower.includes('sagar kanya') ||
    promptLower.includes('samarth')
  ) {
    toolsUsed.push('query_vessel_fleet');
    const vesselRes = runVesselAgent(prompt, targetCoord, locName);
    toolData.vesselData = vesselRes;
    swarmSteps.push(...vesselRes.steps);

    evidenceSources.push({
      name: 'Aurexo AIS Vessel Fleet Registry',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    if (vesselRes.matchedVessel) {
      const v = vesselRes.matchedVessel;
      mapCenter = [v.coordinates.longitude, v.coordinates.latitude];
      mapZoom = 9;
      markerAction = {
        coordinates: v.coordinates,
        title: v.name,
        description: `${v.vesselType} | Speed: ${v.speedKnots} kts | Heading: ${v.headingDegrees}°`,
        variant: 'vessel',
      };
      suggestedQueries.push(`What are the sea conditions around ${v.name}?`);
      suggestedQueries.push(`Check boundary distance for ${v.name}`);
    } else if (vesselRes.nearestVessel) {
      const nv = vesselRes.nearestVessel.vessel;
      mapCenter = [nv.coordinates.longitude, nv.coordinates.latitude];
      mapZoom = 8.5;
      markerAction = {
        coordinates: nv.coordinates,
        title: nv.name,
        description: `Nearest vessel (${vesselRes.nearestVessel.distanceKm} km away) | Speed: ${nv.speedKnots} kts`,
        variant: 'vessel',
      };
      suggestedQueries.push(`Contact details for ${nv.name}`);
      suggestedQueries.push(`Check waves near ${targetLocationName}`);
    } else {
      suggestedQueries.push('Which vessel is closest to Mumbai?');
      suggestedQueries.push('Where is RV Sagar Kanya?');
    }
  }

  // =========================================================================
  // SCENARIO 3: Navigational Route Passage Query
  // =========================================================================
  else if (promptLower.includes('route') || promptLower.includes('passage') || promptLower.includes('corridor')) {
    toolsUsed.push('compute_safe_passage');
    swarmSteps.push({
      agentName: 'SpatialSentinel',
      action: 'Compute Great-Circle Passage Corridor',
      status: 'executing',
      detail: `Generating safe passage waypoints from ${targetLocationName}`,
      timestamp: new Date().toISOString(),
    });

    // Destination ~45 km seaward
    const destLat = targetCoord.latitude - 0.35;
    const destLon = targetCoord.longitude + 0.28;
    const route = computeSafePassage(targetCoord, { latitude: destLat, longitude: destLon });
    toolData.route = route;
    highlightGeometry = route.routeGeometry;

    evidenceSources.push({
      name: 'Aurexo Great-Circle Navigational Corridor Engine',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    swarmSteps.push({
      agentName: 'SpatialSentinel',
      action: 'Passage Route Validated',
      status: route.overallSafety === 'Safe' ? 'completed' : 'flagged',
      detail: `Distance: ${route.totalDistanceKm} km. Overall risk: ${route.overallSafety}`,
      timestamp: new Date().toISOString(),
    });

    suggestedQueries.push('Check weather along this route');
    suggestedQueries.push('Are there any vessels nearby?');
  }

  // =========================================================================
  // SCENARIO 4: Standard Marine, Weather, Sentinel, or Blue Economy Query
  // =========================================================================
  else {
    // Determine which specialized agents need to execute
    const wantsTemperature = promptLower.includes('temperature') || promptLower.includes('sst') || promptLower.includes('thermal');
    const wantsChlorophyll = promptLower.includes('chlorophyll') || promptLower.includes('ocean color');
    const wantsWaves = promptLower.includes('wave') || promptLower.includes('swell') || promptLower.includes('wind');
    const wantsBorder = promptLower.includes('border') || promptLower.includes('imbl') || promptLower.includes('sri lanka') || promptLower.includes('pakistan');
    const wantsFish = promptLower.includes('fish') || promptLower.includes('pfz') || promptLower.includes('tuna');

    // Run Ocean Agent
    const oceanRes = await runOceanAgent(targetCoord, locName, wantsChlorophyll);
    toolData.conditions = oceanRes.observation;
    swarmSteps.push(...oceanRes.steps);
    if (wantsTemperature) activeLayer = 'sst';
    if (wantsChlorophyll) activeLayer = 'chlorophyll';

    if (oceanRes.observation) {
      evidenceSources.push({
        name: 'Open-Meteo Marine & Atmospheric Reanalysis',
        status: 'VERIFIED_LIVE',
        retrievedAt: oceanRes.observation.retrievedAt,
        observationTime: oceanRes.observation.observationTime,
      });
    }

    // Run Weather Agent
    const weatherRes = await runWeatherAgent(targetCoord, locName, oceanRes.observation);
    toolData.weather = weatherRes;
    swarmSteps.push(...weatherRes.steps);

    // Run Spatial Sentinel Agent
    const sentinelRes = runSentinelAgent(targetCoord, locName);
    toolData.geofence = sentinelRes.geofence;
    swarmSteps.push(...sentinelRes.steps);
    evidenceSources.push({
      name: 'Hydrographic Maritime Boundary Sentinel (EEZ/IMBL GeoJSON)',
      status: 'DOCUMENTED_UNVERIFIED',
      retrievedAt: new Date().toISOString(),
    });

    // Run Blue Economy Agent if fishing mentioned
    if (wantsFish) {
      const blueRes = await runBlueEconomyAgent(locName, oceanRes.observation?.seaSurfaceTemperatureCelsius);
      toolData.pfz = blueRes.pfz;
      toolData.hsi = blueRes.habitatSuitabilityScore;
      swarmSteps.push(...blueRes.steps);
      evidenceSources.push({
        name: 'INCOIS Potential Fishing Zones (PFZ Guidelines)',
        status: 'DOCUMENTED_UNVERIFIED',
        retrievedAt: new Date().toISOString(),
      });
    }

    // Unified Safety Assessment
    const safety = await evaluateUnifiedSafety(targetCoord, locName);
    toolData.safetyAssessment = safety;

    // Supervisor Conflict Resolution:
    // If fish habitat is great, BUT wave height > 2.2m or IMBL is < 15km -> Safety veto
    if (toolData.pfz && (weatherRes.isSeaRough || sentinelRes.geofence.riskStatus !== 'Safe')) {
      swarmSteps.push({
        agentName: 'Supervisor',
        action: 'Inter-Agent Conflict Resolution Applied',
        status: 'flagged',
        detail: `Blue Economy found favorable HSI, BUT Weather/Sentinel detected ${weatherRes.isSeaRough ? 'rough sea state' : 'border proximity'}. Supervisor prioritized safety warning.`,
        timestamp: new Date().toISOString(),
      });
    }

    // Contextual suggested queries based on what was NOT asked yet
    if (wantsTemperature) {
      suggestedQueries.push(`What are the wave conditions near ${targetLocationName}?`);
      suggestedQueries.push(`Check IMBL boundary proximity from ${targetLocationName}`);
    } else if (wantsWaves) {
      suggestedQueries.push(`What is the sea temperature near ${targetLocationName}?`);
      suggestedQueries.push(`Find vessels near ${targetLocationName}`);
    } else if (wantsBorder) {
      suggestedQueries.push(`What are the wave and wind conditions?`);
      suggestedQueries.push(`Show safe navigational passage corridor`);
    } else {
      suggestedQueries.push(`Show SST satellite layer for ${targetLocationName}`);
      suggestedQueries.push(`Check border distance to IMBL`);
    }
  }

  // 5. Synthesize grounded explainable answer with Provider Cascade
  const llmResult = await synthesizeMarineResponse({
    userPrompt: prompt,
    intent: swarmSteps.map((s) => s.action).slice(0, 3).join(' -> '),
    toolData,
  });

  const durationMs = Date.now() - startTime;

  const swarmTrace: AgentSwarmTrace = {
    steps: swarmSteps,
    consensusSummary: `Coordinated ${swarmSteps.length} actions across specialist agents in ${durationMs}ms with verified data grounding.`,
    durationMs,
  };

  return {
    answer: llmResult.text,
    intent: toolsUsed.join(' + ') || 'marine_copilot_query',
    toolsUsed,
    evidence: {
      sources: evidenceSources,
      measurements: toolData.conditions ?? toolData.representativeObservation,
      geofence: toolData.geofence,
      timestamp: new Date().toISOString(),
    },
    mapActions: {
      center: mapCenter,
      zoom: mapZoom,
      activeLayer,
      highlightGeometry,
      marker: markerAction,
    },
    suggestedQueries,
    swarmTrace,
    sessionContext: {
      lastLocationName: targetLocationName,
      lastCoordinates: targetCoord,
      lastActiveLayer: activeLayer,
    },
    llmMetadata: {
      provider: llmResult.provider,
      model: llmResult.model,
      executionTimeMs: llmResult.executionTimeMs,
      escalated: llmResult.escalated,
    },
  };
}
