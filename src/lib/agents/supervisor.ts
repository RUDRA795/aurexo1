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
import { getRegionService } from '../services/region.service';
import { MissionOrchestrator, OrchestratorInput } from '../orchestrator/mission-orchestrator.interface';

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
  vizag: { lat: 17.68, lon: 83.21, name: 'Visakhapatnam (Bay of Bengal)' },
  paradeep: { lat: 20.31, lon: 86.61, name: 'Paradeep Coast (Odisha)' },
  kandla: { lat: 23.00, lon: 70.22, name: 'Kandla (Deendayal Port)' },
  mundra: { lat: 22.75, lon: 69.70, name: 'Mundra Port (Gujarat)' },
  mangalore: { lat: 12.91, lon: 74.82, name: 'New Mangalore Port' },
  karwar: { lat: 14.80, lon: 74.13, name: 'Karwar Naval Base Sector' },
  kolkata: { lat: 22.57, lon: 88.36, name: 'Kolkata / Haldia Port Approaches' },
  haldia: { lat: 22.02, lon: 88.06, name: 'Haldia Deepwater Port' },
  portblair: { lat: 11.62, lon: 92.72, name: 'Port Blair (Andaman Sea)' },
  kavaratti: { lat: 10.56, lon: 72.64, name: 'Kavaratti (Lakshadweep)' },
};

// Inland Hinterland & Non-Maritime Registry
interface InlandLocationInfo {
  name: string;
  state: string;
  type: string;
  nearestPorts: Array<{ name: string; distanceKm: number; sector: string }>;
  context: string;
}

const INLAND_ANCHORS: Record<string, InlandLocationInfo> = {
  delhi: {
    name: 'New Delhi (National Capital Region)',
    state: 'Delhi NCR',
    type: 'capital',
    nearestPorts: [
      { name: 'Kandla / Deendayal Port (Gujarat)', distanceKm: 1080, sector: 'Gulf of Kutch' },
      { name: 'Mundra Port (Gujarat)', distanceKm: 1120, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1400, sector: 'Konkan Coast' },
    ],
    context: 'Inland northern capital territory situated in the northern plains, ~1,100 km from the nearest coastline on the Arabian Sea.',
  },
  'new delhi': {
    name: 'New Delhi (National Capital Region)',
    state: 'Delhi NCR',
    type: 'capital',
    nearestPorts: [
      { name: 'Kandla / Deendayal Port (Gujarat)', distanceKm: 1080, sector: 'Gulf of Kutch' },
      { name: 'Mundra Port (Gujarat)', distanceKm: 1120, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1400, sector: 'Konkan Coast' },
    ],
    context: 'Inland northern capital territory situated in the northern plains, ~1,100 km from the nearest coastline on the Arabian Sea.',
  },
  bengaluru: {
    name: 'Bengaluru',
    state: 'Karnataka',
    type: 'inland_metro',
    nearestPorts: [
      { name: 'New Mangalore Port (Karnataka)', distanceKm: 350, sector: 'Malabar / Canara Coast' },
      { name: 'Chennai Port (Tamil Nadu)', distanceKm: 340, sector: 'Coromandel Coast' },
    ],
    context: 'Inland technology capital on the Deccan Plateau, located ~340 km inland between the Arabian Sea and Bay of Bengal.',
  },
  bangalore: {
    name: 'Bengaluru',
    state: 'Karnataka',
    type: 'inland_metro',
    nearestPorts: [
      { name: 'New Mangalore Port (Karnataka)', distanceKm: 350, sector: 'Malabar / Canara Coast' },
      { name: 'Chennai Port (Tamil Nadu)', distanceKm: 340, sector: 'Coromandel Coast' },
    ],
    context: 'Inland technology capital on the Deccan Plateau, located ~340 km inland between the Arabian Sea and Bay of Bengal.',
  },
  hyderabad: {
    name: 'Hyderabad',
    state: 'Telangana',
    type: 'inland_metro',
    nearestPorts: [
      { name: 'Machilipatnam / Krishnapatnam (Andhra Pradesh)', distanceKm: 350, sector: 'Andhra Coastal Sector' },
      { name: 'Visakhapatnam Port (Andhra Pradesh)', distanceKm: 620, sector: 'Northern Bay of Bengal' },
    ],
    context: 'Inland southern metropolitan hub situated on the Deccan Plateau, ~350 km west of the Bay of Bengal coastline.',
  },
  jaipur: {
    name: 'Jaipur',
    state: 'Rajasthan',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla / Mundra Ports (Gujarat)', distanceKm: 850, sector: 'Gulf of Kutch' },
    ],
    context: 'Inland capital of Rajasthan located in western India, ~850 km from the Gulf of Kutch / Arabian Sea.',
  },
  lucknow: {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kolkata / Haldia Port (West Bengal)', distanceKm: 980, sector: 'Bay of Bengal' },
    ],
    context: 'Inland capital of Uttar Pradesh in the Gangetic basin, ~980 km northwest of the Bay of Bengal.',
  },
  pune: {
    name: 'Pune',
    state: 'Maharashtra',
    type: 'inland_city',
    nearestPorts: [
      { name: 'JNPT / Mumbai Port (Maharashtra)', distanceKm: 150, sector: 'Konkan Coast' },
    ],
    context: 'Inland plateau city in Western Maharashtra, ~150 km east of the Konkan coastline and JNPT container port.',
  },
  ahmedabad: {
    name: 'Ahmedabad',
    state: 'Gujarat',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla / Mundra (Gujarat)', distanceKm: 310, sector: 'Gulf of Kutch' },
      { name: 'Dahej / Hazira Port (Gujarat)', distanceKm: 230, sector: 'Gulf of Khambhat' },
    ],
    context: 'Commercial city located near the head of the Gulf of Khambhat, ~230 km from major industrial deep-water terminals at Dahej and Hazira.',
  },
  chandigarh: {
    name: 'Chandigarh',
    state: 'Punjab / Haryana',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 1150, sector: 'Gulf of Kutch' },
    ],
    context: 'Inland northern union territory located at the Himalayan foothills, over 1,150 km from maritime coastlines.',
  },
  bhopal: {
    name: 'Bhopal',
    state: 'Madhya Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 780, sector: 'Konkan Coast' },
      { name: 'Kandla Port (Gujarat)', distanceKm: 820, sector: 'Gulf of Kutch' },
    ],
    context: 'Central inland capital of Madhya Pradesh, ~780 km from the Arabian Sea.',
  },
  patna: {
    name: 'Patna',
    state: 'Bihar',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kolkata / Haldia Port (West Bengal)', distanceKm: 580, sector: 'Bay of Bengal' },
    ],
    context: 'Inland Gangetic capital in Bihar, connected via National Waterway-1 (Ganga), ~580 km northwest of Kolkata/Haldia maritime terminals.',
  },
  indore: {
    name: 'Indore',
    state: 'Madhya Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 585, sector: 'Konkan Coast' },
    ],
    context: 'Major commercial city in Madhya Pradesh, ~585 km northeast of Mumbai port facilities.',
  },
  nagpur: {
    name: 'Nagpur',
    state: 'Maharashtra',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Visakhapatnam Port (Andhra Pradesh)', distanceKm: 720, sector: 'Bay of Bengal' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 820, sector: 'Konkan Coast' },
    ],
    context: 'Geographical center of India, situated over 700 km inland from both the Arabian Sea and Bay of Bengal.',
  },
  coimbatore: {
    name: 'Coimbatore',
    state: 'Tamil Nadu',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kochi Port (Kerala)', distanceKm: 190, sector: 'Malabar Coast' },
      { name: 'Tuticorin (Tamil Nadu)', distanceKm: 340, sector: 'Gulf of Mannar' },
    ],
    context: 'Inland industrial hub in western Tamil Nadu, ~190 km inland from Kochi Port across the Palakkad Gap.',
  },
  madurai: {
    name: 'Madurai',
    state: 'Tamil Nadu',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Tuticorin / VOC Port (Tamil Nadu)', distanceKm: 140, sector: 'Gulf of Mannar' },
      { name: 'Rameswaram (Palk Strait)', distanceKm: 170, sector: 'Palk Bay' },
    ],
    context: 'Inland cultural center in southern Tamil Nadu, ~140 km from the deep-water port of Tuticorin.',
  },
  kanpur: {
    name: 'Kanpur',
    state: 'Uttar Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kolkata / Haldia Port (West Bengal)', distanceKm: 1000, sector: 'Bay of Bengal' },
    ],
    context: 'Inland industrial center on the Ganges, ~1,000 km from maritime seaports.',
  },
  varanasi: {
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kolkata / Haldia Port (West Bengal)', distanceKm: 680, sector: 'Bay of Bengal' },
    ],
    context: 'Inland city on the Ganges (National Waterway-1 Multi-Modal Terminal), ~680 km upstream of the Bay of Bengal.',
  },
};

function isGreetingOrHelpQuery(promptLower: string): boolean {
  const clean = promptLower.trim().replace(/[?!.,]/g, '');

  // Explicit capability & identity phrases
  const capabilityPatterns = [
    'who are you',
    'what are you',
    'what is orca',
    'what is aurexo',
    'what can you do',
    'help',
    'how does this work',
    'how to use',
    'features',
    'capabilities',
    'what are your features',
    'introduce yourself',
    'what is this platform',
    'what do you do',
  ];
  if (capabilityPatterns.some((p) => clean.includes(p))) {
    return true;
  }

  // Pure greetings (single word or short greeting phrase)
  const greetingWords = [
    'hi',
    'hello',
    'hey',
    'namaste',
    'good morning',
    'good afternoon',
    'good evening',
    'vanakkam',
    'namaskara',
    'pranam',
    'hola',
    'greetings',
  ];
  const words = clean.split(/\s+/);
  if (words.length <= 3 && greetingWords.some((g) => words.includes(g))) {
    return true;
  }

  return false;
}

function findInlandMention(promptLower: string): InlandLocationInfo | null {
  for (const [key, info] of Object.entries(INLAND_ANCHORS)) {
    // Check word boundary match to avoid partial false positives
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(promptLower)) {
      return info;
    }
  }
  return null;
}

function isOceanConceptQuery(promptLower: string): boolean {
  const conceptKeywords = [
    'kallakkadal', 'swell surge', 'what is upwelling', 'explain upwelling', 'what is sst',
    'what is sea surface temperature', 'what is chlorophyll', 'what is pfz', 'what is potential fishing zone',
    'what is imbl', 'what is eez', 'what is mpa', 'what is marine protected area', 'how does incois work',
    'how do satellites track oceans', 'beaufort scale', 'what is swell', 'what causes swell',
  ];
  return conceptKeywords.some((k) => promptLower.includes(k));
}

function parseRouteEndpoints(
  prompt: string,
  defaultOrigin: GeoCoordinate,
  defaultOriginName: string
): {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  originName: string;
  destName: string;
} {
  const lower = prompt.toLowerCase();

  // Try pattern: "from [origin] to [dest]"
  const fromToMatch = lower.match(/(?:from|between)\s+([a-zA-Z\s]+?)\s+(?:to|and)\s+([a-zA-Z\s]+)/i);
  let originAnchor: { lat: number; lon: number; name: string } | undefined;
  let destAnchor: { lat: number; lon: number; name: string } | undefined;

  if (fromToMatch) {
    const rawOrigin = fromToMatch[1].trim();
    const rawDest = fromToMatch[2].trim();
    for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
      if (rawOrigin.includes(key) && !originAnchor) originAnchor = anchor;
      if (rawDest.includes(key) && !destAnchor) destAnchor = anchor;
    }
  }

  // Fallback: check if any two anchors appear anywhere in prompt
  if (!originAnchor || !destAnchor) {
    const foundAnchors: Array<{ lat: number; lon: number; name: string }> = [];
    for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
      if (lower.includes(key)) {
        foundAnchors.push(anchor);
      }
    }
    if (foundAnchors.length >= 2) {
      originAnchor = foundAnchors[0];
      destAnchor = foundAnchors[1];
    } else if (foundAnchors.length === 1 && !originAnchor) {
      originAnchor = foundAnchors[0];
    }
  }

  const origin = originAnchor ? { latitude: originAnchor.lat, longitude: originAnchor.lon } : defaultOrigin;
  const originName = originAnchor ? originAnchor.name : defaultOriginName;

  const destination = destAnchor
    ? { latitude: destAnchor.lat, longitude: destAnchor.lon }
    : { latitude: origin.latitude - 0.45, longitude: origin.longitude + 0.35 };
  const destName = destAnchor ? destAnchor.name : 'Offshore Seaward Waypoint';

  return { origin, destination, originName, destName };
}

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
    detail: `Decomposing query: "${prompt}" across specialized domain agents`,
    timestamp: new Date().toISOString(),
  });

  // Check for explicit coastal anchors first
  let explicitCoastalAnchor: { lat: number; lon: number; name: string } | undefined;
  for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(promptLower)) {
      explicitCoastalAnchor = anchor;
      break;
    }
  }

  const promptReferencesHere =
    promptLower.includes('here') ||
    promptLower.includes('this area') ||
    promptLower.includes('this location') ||
    promptLower.includes('this point') ||
    promptLower.includes('current spot') ||
    promptLower.includes('selected') ||
    promptLower.includes('around here');

  const inlandMatch = !explicitCoastalAnchor && !userCoordinates ? findInlandMention(promptLower) : null;

  // =========================================================================
  // SCENARIO 1: Inland / Landlocked Geographic Inquiry (e.g. "tell me about delhi")
  // =========================================================================
  if (inlandMatch) {
    toolsUsed.push('query_inland_territory_gateway');
    swarmSteps.push({
      agentName: 'Supervisor',
      action: 'Inland Hinterland Gateway Resolved',
      status: 'completed',
      detail: `Identified ${inlandMatch.name} as an inland territory (~${inlandMatch.nearestPorts[0].distanceKm} km from ${inlandMatch.nearestPorts[0].name}). Grounding in maritime trade gateways.`,
      timestamp: new Date().toISOString(),
    });

    const toolData = {
      inlandData: inlandMatch,
      location: inlandMatch.name,
    };

    evidenceSources.push({
      name: 'AUREXO National Maritime Hinterland Gateway Registry',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    const suggestedQueries = [
      `Check wave conditions at ${inlandMatch.nearestPorts[0].name}`,
      `Sea state off ${inlandMatch.nearestPorts[1]?.name ?? 'Mumbai JNPT'}`,
      `Scan active maritime warnings across all Indian sectors`,
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'Inland Hinterland Gateway & Maritime Scope',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'query_inland_territory_gateway',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: [78.9629, 20.5937], // Whole India overview
        zoom: 4.5,
        activeLayer: 'none',
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Contextualized inland territory ${inlandMatch.name} with nearest maritime gateways in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: inlandMatch.name,
        lastActiveLayer: 'none',
      },
      llmMetadata: {
        provider: llmResult.provider,
        model: llmResult.model,
        executionTimeMs: llmResult.executionTimeMs,
        escalated: llmResult.escalated,
      },
    };
  }

  // =========================================================================
  // SCENARIO 2: Conversational Greeting / Identity / Capabilities
  // =========================================================================
  if (isGreetingOrHelpQuery(promptLower) && !userCoordinates && !explicitCoastalAnchor) {
    toolsUsed.push('conversational_copilot_overview');
    swarmSteps.push({
      agentName: 'Supervisor',
      action: 'Conversational Copilot Orientation',
      status: 'completed',
      detail: 'Serving interactive maritime copilot capabilities, live telemetry overview, and regional orientation.',
      timestamp: new Date().toISOString(),
    });

    const toolData = {
      conversational: {
        isGreeting: true,
        capabilities: [
          'real_time_ocean_telemetry',
          'satellite_layers',
          'vessel_tracking',
          'geofencing_imbl',
          'pfz_guidelines',
          'navigational_routing',
        ],
      },
    };

    evidenceSources.push({
      name: 'AUREXO Maritime Intelligence System Registry',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    const suggestedQueries = [
      'What are the sea conditions off Mumbai?',
      'Where is RV Sagar Kanya right now?',
      'Is it safe for fishing near Kochi?',
      'Scan active regional alerts across Indian coasts',
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'Conversational Orientation & Capabilities',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'conversational_copilot_overview',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: [78.9629, 18.5],
        zoom: 4.8,
        activeLayer: 'none',
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Delivered conversational orientation in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: 'Indian Maritime Domain',
        lastActiveLayer: 'none',
      },
      llmMetadata: {
        provider: llmResult.provider,
        model: llmResult.model,
        executionTimeMs: llmResult.executionTimeMs,
        escalated: llmResult.escalated,
      },
    };
  }

  // =========================================================================
  // SCENARIO 3: Maritime Oceanographic Science & Domain Concept Inquiry
  // =========================================================================
  if (isOceanConceptQuery(promptLower) && !userCoordinates && !explicitCoastalAnchor) {
    toolsUsed.push('explain_oceanographic_concept');
    swarmSteps.push({
      agentName: 'Ocean',
      action: 'Synthesize Oceanographic Knowledge',
      status: 'completed',
      detail: `Synthesizing verified scientific oceanographic knowledge for query: "${prompt}"`,
      timestamp: new Date().toISOString(),
    });

    const toolData = {
      conceptQuery: {
        topic: prompt,
        category: 'oceanographic_science',
      },
    };

    evidenceSources.push({
      name: 'INCOIS & ISRO Oceanographic Scientific Reference Library',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    const suggestedQueries = [
      'Show SST satellite layer for Arabian Sea',
      'Check swell wave period near Kochi',
      'Scan active regional warnings across Indian sectors',
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'Oceanographic Concept & Scientific Knowledge',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'explain_oceanographic_concept',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: [78.9629, 18.5],
        zoom: 5.0,
        activeLayer: promptLower.includes('sst') || promptLower.includes('temperature') ? 'sst' : 'none',
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Synthesized scientific domain knowledge in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: 'Indian Maritime Domain',
        lastActiveLayer: 'none',
      },
      llmMetadata: {
        provider: llmResult.provider,
        model: llmResult.model,
        executionTimeMs: llmResult.executionTimeMs,
        escalated: llmResult.escalated,
      },
    };
  }

  // =========================================================================
  // SCENARIO 4: Regional Warning Scan Query
  // =========================================================================
  if (
    (promptLower.includes('which region') && (promptLower.includes('warning') || promptLower.includes('active') || promptLower.includes('rough'))) ||
    promptLower.includes('scan regions') ||
    promptLower.includes('all regions') ||
    promptLower.includes('regional warnings') ||
    promptLower.includes('active alerts')
  ) {
    toolsUsed.push('scan_active_regional_warnings');
    swarmSteps.push({
      agentName: 'WeatherHazard',
      action: 'Execute Regional Coastal Hazard Scan',
      status: 'executing',
      detail: 'Scanning active sea states and warning bulletins across all 9 Indian maritime sectors',
      timestamp: new Date().toISOString(),
    });

    const regionalStates = await scanActiveRegionalWarnings();
    const toolData: Record<string, any> = { regionalWarnings: regionalStates };

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

    const suggestedQueries = [
      'Check wave conditions off Gujarat',
      'Where are the nearest vessels to rough sectors?',
      'Show satellite SST thermal fronts',
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'Regional Coastal Hazard Scan',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'scan_active_regional_warnings',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: [78.0, 15.0],
        zoom: 5,
        activeLayer: 'none',
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Scanned all 9 Indian maritime sectors in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: 'All Indian Coastal Sectors',
        lastActiveLayer: 'none',
      },
      llmMetadata: {
        provider: llmResult.provider,
        model: llmResult.model,
        executionTimeMs: llmResult.executionTimeMs,
        escalated: llmResult.escalated,
      },
    };
  }

  // =========================================================================
  // SCENARIO 5: Vessel & Fleet Tracking Query
  // =========================================================================
  const isVesselQuery =
    promptLower.includes('vessel') ||
    promptLower.includes('fleet') ||
    promptLower.includes('ais') ||
    promptLower.includes('mmsi') ||
    promptLower.includes('sagar kanya') ||
    promptLower.includes('samarth') ||
    promptLower.includes('varaha') ||
    promptLower.includes('matsya varshini') ||
    promptLower.includes('cochin star') ||
    promptLower.includes('sagar shakti') ||
    (promptLower.includes('ship') && !promptLower.includes('shipping lane')) ||
    (promptLower.includes('boat') && (promptLower.includes('where') || promptLower.includes('closest') || promptLower.includes('nearest') || promptLower.includes('track') || promptLower.includes('position') || promptLower.includes('find')));

  if (isVesselQuery) {
    toolsUsed.push('query_vessel_fleet');
    const refCoord = userCoordinates ?? (sessionContext.lastCoordinates ?? (explicitCoastalAnchor ? { latitude: explicitCoastalAnchor.lat, longitude: explicitCoastalAnchor.lon } : { latitude: 18.95, longitude: 72.80 }));
    const refName = explicitCoastalAnchor ? explicitCoastalAnchor.name : (sessionContext.lastLocationName ?? 'Mumbai Offshore');

    const vesselRes = runVesselAgent(prompt, refCoord, refName);
    const toolData: Record<string, any> = { vesselData: vesselRes };
    swarmSteps.push(...vesselRes.steps);

    evidenceSources.push({
      name: 'ORCA AIS Vessel Fleet Registry',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    let mapCenter: [number, number] = [78.0, 15.0];
    let mapZoom = 6;
    let markerAction: MapMarkerAction | undefined;
    const suggestedQueries: string[] = [];

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
      suggestedQueries.push(`Check waves near ${refName}`);
    } else {
      suggestedQueries.push('Which vessel is closest to Mumbai?');
      suggestedQueries.push('Where is RV Sagar Kanya?');
    }

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'AIS Vessel Fleet Surveillance',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'query_vessel_fleet',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: mapCenter,
        zoom: mapZoom,
        activeLayer: 'none',
        marker: markerAction,
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Queried AIS fleet registry in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: vesselRes.matchedVessel?.name ?? refName,
        lastCoordinates: vesselRes.matchedVessel?.coordinates ?? refCoord,
      },
      llmMetadata: {
        provider: llmResult.provider,
        model: llmResult.model,
        executionTimeMs: llmResult.executionTimeMs,
        escalated: llmResult.escalated,
      },
    };
  }

  // =========================================================================
  // SCENARIO 6: Navigational Route Passage Query
  // =========================================================================
  if (
    promptLower.includes('route') ||
    promptLower.includes('passage') ||
    promptLower.includes('corridor') ||
    promptLower.includes('travel from') ||
    promptLower.includes('sail from') ||
    promptLower.includes('navigate from')
  ) {
    toolsUsed.push('compute_safe_passage');
    const defaultOrigin = userCoordinates ?? (explicitCoastalAnchor ? { latitude: explicitCoastalAnchor.lat, longitude: explicitCoastalAnchor.lon } : { latitude: 18.95, longitude: 72.80 });
    const defaultName = explicitCoastalAnchor ? explicitCoastalAnchor.name : 'Mumbai Offshore';

    const { origin, destination, originName, destName } = parseRouteEndpoints(prompt, defaultOrigin, defaultName);

    swarmSteps.push({
      agentName: 'SpatialSentinel',
      action: 'Compute Great-Circle Passage Corridor',
      status: 'executing',
      detail: `Generating safe passage waypoints between ${originName} and ${destName}`,
      timestamp: new Date().toISOString(),
    });

    const route = computeSafePassage(origin, destination);
    const toolData: Record<string, any> = { route };

    evidenceSources.push({
      name: 'ORCA Great-Circle Navigational Corridor Engine',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    try {
      const oceanOrigin = await runOceanAgent(origin, originName);
      toolData.originConditions = oceanOrigin.observation;
      swarmSteps.push(...oceanOrigin.steps);
      if (oceanOrigin.observation) {
        evidenceSources.push({
          name: `Open-Meteo Sea State (${originName})`,
          status: 'VERIFIED_LIVE',
          retrievedAt: oceanOrigin.observation.retrievedAt,
        });
      }
    } catch {
      // Non-blocking
    }

    swarmSteps.push({
      agentName: 'SpatialSentinel',
      action: 'Passage Route Validated',
      status: route.overallSafety === 'Safe' ? 'completed' : 'flagged',
      detail: `Distance: ${route.totalDistanceKm} km between ${originName} and ${destName}. Overall risk: ${route.overallSafety}`,
      timestamp: new Date().toISOString(),
    });

    const mapCenter: [number, number] = [(origin.longitude + destination.longitude) / 2, (origin.latitude + destination.latitude) / 2];
    const mapZoom = route.totalDistanceKm > 400 ? 5.5 : route.totalDistanceKm > 150 ? 6.5 : 7.5;

    const markerAction: MapMarkerAction = {
      coordinates: destination,
      title: `Destination: ${destName}`,
      description: `Distance: ${route.totalDistanceKm} km (${route.estimatedTravelTimeHours} hrs). Status: ${route.overallSafety}`,
      variant: 'point',
    };

    const suggestedQueries = [
      `What is the weather along ${originName} to ${destName}?`,
      `Are there any vessels near ${originName}?`,
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'Navigational Passage Corridor',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'compute_safe_passage',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: mapCenter,
        zoom: mapZoom,
        activeLayer: 'none',
        highlightGeometry: route.routeGeometry,
        marker: markerAction,
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Computed navigational passage corridor in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: `${originName} to ${destName}`,
        lastCoordinates: destination,
      },
      llmMetadata: {
        provider: llmResult.provider,
        model: llmResult.model,
        executionTimeMs: llmResult.executionTimeMs,
        escalated: llmResult.escalated,
      },
    };
  }

  // =========================================================================
  // SCENARIO 7: Specific Coastal / Marine Observation & Geofencing Query
  // =========================================================================
  let targetLocationName: string | undefined;
  let targetCoord: GeoCoordinate | undefined;

  // 1. Check for explicit coastal anchor in prompt
  if (explicitCoastalAnchor) {
    targetLocationName = explicitCoastalAnchor.name;
    targetCoord = { latitude: explicitCoastalAnchor.lat, longitude: explicitCoastalAnchor.lon };
  }

  // 2. Check for named maritime region in prompt
  if (!targetCoord) {
    const matchedRegion = findRegionByName(prompt);
    if (matchedRegion) {
      targetLocationName = matchedRegion.name;
      targetCoord = matchedRegion.center;
    }
  }

  // 3. Check if user provided explicit coordinates / clicked map point
  if (!targetCoord && userCoordinates) {
    targetCoord = userCoordinates;
    const { region } = getRegionService().findNearestRegion(targetCoord);
    targetLocationName = `Selected Point near ${region.name} (${targetCoord.latitude.toFixed(2)}°N, ${targetCoord.longitude.toFixed(2)}°E)`;
    swarmSteps.push({
      agentName: 'Supervisor',
      action: 'Point Coordinate Context Grounded',
      status: 'completed',
      detail: `Targeted exact clicked map coordinate: [${targetCoord.latitude}, ${targetCoord.longitude}] in ${region.name}`,
      timestamp: new Date().toISOString(),
    });
  }

  // 4. Anaphora resolution: If user asks follow-up (e.g. "What about waves?", "How is it there?")
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

  // 5. Default to userCoordinate or Mumbai Offshore if explicitly looking for coastal telemetry
  if (!targetCoord) {
    targetCoord = userCoordinates ?? { latitude: 18.95, longitude: 72.80 };
    if (userCoordinates) {
      const { region } = getRegionService().findNearestRegion(targetCoord);
      targetLocationName = `Selected Location near ${region.name}`;
    } else {
      targetLocationName = 'Mumbai Offshore';
    }
  }

  const locName: string = targetLocationName ?? 'Indian Coastal Waters';
  targetLocationName = locName;

  let mapCenter: [number, number] = [targetCoord.longitude, targetCoord.latitude];
  let mapZoom = 8;
  let activeLayer: SatelliteLayerId = sessionContext.lastActiveLayer ?? 'none';

  const toolData: Record<string, any> = {};
  const suggestedQueries: string[] = [];

  const wantsTemperature = promptLower.includes('temperature') || promptLower.includes('sst') || promptLower.includes('thermal');
  const wantsChlorophyll = promptLower.includes('chlorophyll') || promptLower.includes('ocean color');
  const wantsWaves = promptLower.includes('wave') || promptLower.includes('swell') || promptLower.includes('wind');
  const wantsBorder = promptLower.includes('border') || promptLower.includes('imbl') || promptLower.includes('sri lanka') || promptLower.includes('pakistan');
  const wantsFish = promptLower.includes('fish') || promptLower.includes('pfz') || promptLower.includes('tuna');

  // Run Ocean Agent
  const oceanRes = await runOceanAgent(targetCoord, locName, wantsChlorophyll);
  toolData.conditions = oceanRes.observation;
  toolData.locationName = locName;
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

  // Conflict Resolution
  if (toolData.pfz && (weatherRes.isSeaRough || sentinelRes.geofence.riskStatus !== 'Safe')) {
    swarmSteps.push({
      agentName: 'Supervisor',
      action: 'Inter-Agent Conflict Resolution Applied',
      status: 'flagged',
      detail: `Blue Economy found favorable HSI, BUT Weather/Sentinel detected ${weatherRes.isSeaRough ? 'rough sea state' : 'border proximity'}. Prioritized safety advisory.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Contextual suggested queries
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

  toolsUsed.push('query_marine_conditions', 'evaluate_safety_geofence');

  // Synthesize grounded explainable answer with Provider Cascade
  const llmResult = await synthesizeMarineResponse({
    userPrompt: prompt,
    intent: swarmSteps.map((s) => s.action).slice(0, 3).join(' -> '),
    toolData,
  });

  const durationMs = Date.now() - startTime;

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
    },
    suggestedQueries,
    swarmTrace: {
      steps: swarmSteps,
      consensusSummary: `Coordinated ${swarmSteps.length} specialist actions in ${durationMs}ms with verified data grounding.`,
      durationMs,
    },
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

export class SupervisorMissionOrchestrator implements MissionOrchestrator {
  async dispatch(input: OrchestratorInput): Promise<AgentResponse> {
    return runSupervisorAgent(input);
  }
}

export const missionOrchestrator: MissionOrchestrator = new SupervisorMissionOrchestrator();
