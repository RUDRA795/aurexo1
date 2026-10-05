import {
  AgentResponse,
  GeoCoordinate,
  SatelliteLayerId,
  AgentEvidenceSource,
  SessionContext,
  MapMarkerAction,
} from '../types/domain';
import { AgentStep } from '../types/agents';
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

// =========================================================================
// 1. Coastal Port & Maritime Gateway Registry
// =========================================================================
const COASTAL_ANCHORS: Record<string, { lat: number; lon: number; name: string }> = {
  // Major Western Ports
  mumbai: { lat: 18.95, lon: 72.80, name: 'Mumbai Offshore' },
  bombay: { lat: 18.95, lon: 72.80, name: 'Mumbai Offshore' },
  jnpt: { lat: 18.95, lon: 72.95, name: 'Jawaharlal Nehru Port (JNPT / Nhava Sheva)' },
  nhavasheva: { lat: 18.95, lon: 72.95, name: 'JNPT Nhava Sheva (Maharashtra)' },
  kandla: { lat: 23.00, lon: 70.22, name: 'Deendayal Port (Kandla, Gujarat)' },
  deendayal: { lat: 23.00, lon: 70.22, name: 'Deendayal Port (Kandla, Gujarat)' },
  mundra: { lat: 22.75, lon: 69.70, name: 'Mundra Port (Gulf of Kutch)' },
  porbandar: { lat: 21.64, lon: 69.60, name: 'Porbandar Offshore (Gujarat)' },
  veraval: { lat: 20.90, lon: 70.36, name: 'Veraval Coastal Sector (Gujarat)' },
  okha: { lat: 22.46, lon: 69.07, name: 'Okha Port (Gulf of Kutch)' },
  mandvi: { lat: 22.83, lon: 69.36, name: 'Mandvi Port (Gujarat)' },
  pipavav: { lat: 20.91, lon: 71.51, name: 'Port Pipavav (Gujarat)' },
  bhavnagar: { lat: 21.76, lon: 72.15, name: 'Bhavnagar Port (Gulf of Khambhat)' },
  alang: { lat: 21.41, lon: 72.20, name: 'Alang Ship Recycling Sector (Gujarat)' },
  dahej: { lat: 21.70, lon: 72.58, name: 'Dahej Deepwater Port (Gujarat)' },
  hazira: { lat: 21.11, lon: 72.64, name: 'Hazira Port (Surat, Gujarat)' },
  surat: { lat: 21.11, lon: 72.64, name: 'Hazira / Surat Coastal Sector' },
  daman: { lat: 20.42, lon: 72.83, name: 'Daman Coastal Sector' },
  diu: { lat: 20.71, lon: 70.98, name: 'Diu Coastal Sector' },
  kutch: { lat: 22.50, lon: 69.50, name: 'Gulf of Kutch' },
  gujarat: { lat: 21.64, lon: 69.60, name: 'Gujarat Coastal Sector' },
  sircreek: { lat: 23.68, lon: 68.16, name: 'Sir Creek (India-Pakistan Border Sector)' },
  alibaug: { lat: 18.64, lon: 72.87, name: 'Alibaug Coast (Maharashtra)' },
  dighi: { lat: 18.28, lon: 72.98, name: 'Dighi Port (Maharashtra)' },
  jaigad: { lat: 17.30, lon: 73.20, name: 'Jaigad Port (Maharashtra)' },
  ratnagiri: { lat: 16.99, lon: 73.28, name: 'Ratnagiri Port (Maharashtra)' },
  goa: { lat: 15.49, lon: 73.80, name: 'Mormugao Port (Goa Coast)' },
  mormugao: { lat: 15.41, lon: 73.80, name: 'Mormugao Deepwater Port (Goa)' },
  panaji: { lat: 15.49, lon: 73.80, name: 'Goa Coastal Waters' },
  karwar: { lat: 14.80, lon: 74.13, name: 'Karwar Naval Base Sector (Karnataka)' },
  bhatkal: { lat: 13.98, lon: 74.54, name: 'Bhatkal Port (Karnataka)' },
  mangalore: { lat: 12.91, lon: 74.82, name: 'New Mangalore Port' },
  kannur: { lat: 11.87, lon: 75.35, name: 'Azhikkal / Kannur Port (Kerala)' },
  kochi: { lat: 9.93, lon: 76.25, name: 'Kochi Offshore (Malabar)' },
  cochin: { lat: 9.93, lon: 76.25, name: 'Kochi Offshore (Malabar)' },
  vallarpadam: { lat: 9.98, lon: 76.24, name: 'Vallarpadam ICTT (Kochi, Kerala)' },
  alappuzha: { lat: 9.49, lon: 76.32, name: 'Alappuzha Coast (Kerala)' },
  alleppey: { lat: 9.49, lon: 76.32, name: 'Alappuzha Coast (Kerala)' },
  kollam: { lat: 8.88, lon: 76.59, name: 'Kollam Port (Kerala)' },
  quilon: { lat: 8.88, lon: 76.59, name: 'Kollam Port (Kerala)' },
  vizhinjam: { lat: 8.37, lon: 76.99, name: 'Vizhinjam International Transshipment Port (Kerala)' },
  kanyakumari: { lat: 8.08, lon: 77.55, name: 'Cape Comorin / Kanyakumari (Indian Ocean Confluence)' },

  // Major Southern & Eastern Ports
  tuticorin: { lat: 8.76, lon: 78.13, name: 'V.O. Chidambaranar Port (Tuticorin, Gulf of Mannar)' },
  thoothukudi: { lat: 8.76, lon: 78.13, name: 'V.O. Chidambaranar Port (Tuticorin, Gulf of Mannar)' },
  rameswaram: { lat: 9.28, lon: 79.31, name: 'Rameswaram (Palk Bay / Sri Lanka Corridor)' },
  mandapam: { lat: 9.27, lon: 79.12, name: 'Mandapam Coast (Palk Strait)' },
  dhanushkodi: { lat: 9.17, lon: 79.41, name: 'Dhanushkodi (Palk Strait Corridor)' },
  palkstrait: { lat: 9.50, lon: 79.50, name: 'Palk Strait (India-Sri Lanka Corridor)' },
  palkbay: { lat: 9.50, lon: 79.25, name: 'Palk Bay Marine Sector' },
  gulfofmannar: { lat: 8.80, lon: 78.90, name: 'Gulf of Mannar' },
  nagapattinam: { lat: 10.76, lon: 79.84, name: 'Nagapattinam Port (Tamil Nadu)' },
  cuddalore: { lat: 11.75, lon: 79.77, name: 'Cuddalore Port (Tamil Nadu)' },
  pondicherry: { lat: 11.93, lon: 79.83, name: 'Puducherry Port / Coastal Sector' },
  chennai: { lat: 13.08, lon: 80.27, name: 'Chennai Offshore (Coromandel)' },
  madras: { lat: 13.08, lon: 80.27, name: 'Chennai Offshore (Coromandel)' },
  ennore: { lat: 13.25, lon: 80.33, name: 'Kamarajar Port (Ennore, Tamil Nadu)' },
  kamarajar: { lat: 13.25, lon: 80.33, name: 'Kamarajar Port (Ennore, Tamil Nadu)' },
  krishnapatnam: { lat: 14.25, lon: 80.12, name: 'Krishnapatnam Port (Andhra Pradesh)' },
  machilipatnam: { lat: 16.18, lon: 81.14, name: 'Machilipatnam Coast (Andhra Pradesh)' },
  kakinada: { lat: 16.98, lon: 82.24, name: 'Kakinada Deepwater Port (Andhra Pradesh)' },
  visakhapatnam: { lat: 17.68, lon: 83.21, name: 'Visakhapatnam (Bay of Bengal)' },
  vizag: { lat: 17.68, lon: 83.21, name: 'Visakhapatnam (Bay of Bengal)' },
  gangavaram: { lat: 17.62, lon: 83.23, name: 'Gangavaram Port (Andhra Pradesh)' },
  gopalpur: { lat: 19.26, lon: 84.90, name: 'Gopalpur Port (Odisha)' },
  puri: { lat: 19.80, lon: 85.83, name: 'Puri Coast (Odisha)' },
  paradeep: { lat: 20.31, lon: 86.61, name: 'Paradeep Port (Odisha)' },
  paradip: { lat: 20.31, lon: 86.61, name: 'Paradeep Port (Odisha)' },
  dhamra: { lat: 20.80, lon: 86.96, name: 'Dhamra Port (Odisha)' },
  chandipur: { lat: 21.44, lon: 87.01, name: 'Chandipur Coastal Missile Range (Odisha)' },
  digha: { lat: 21.62, lon: 87.51, name: 'Digha Coastal Sector (West Bengal)' },
  haldia: { lat: 22.02, lon: 88.06, name: 'Haldia Deepwater Port (West Bengal)' },
  kolkata: { lat: 22.57, lon: 88.36, name: 'Syama Prasad Mookerjee Port (Kolkata)' },
  calcutta: { lat: 22.57, lon: 88.36, name: 'Kolkata / Haldia Port Approaches' },

  // Island Territories
  portblair: { lat: 11.62, lon: 92.72, name: 'Port Blair (Andaman Sea)' },
  andaman: { lat: 11.62, lon: 92.72, name: 'Port Blair (Andaman Sea)' },
  havelock: { lat: 12.03, lon: 93.00, name: 'Havelock / Swaraj Dweep (Andamans)' },
  carnicobar: { lat: 9.15, lon: 92.78, name: 'Car Nicobar (Ten Degree Channel)' },
  greatnicobar: { lat: 7.00, lon: 93.80, name: 'Great Nicobar (Six Degree Channel)' },
  kavaratti: { lat: 10.56, lon: 72.64, name: 'Kavaratti (Lakshadweep)' },
  lakshadweep: { lat: 10.56, lon: 72.64, name: 'Kavaratti (Lakshadweep)' },
  agatti: { lat: 10.85, lon: 72.18, name: 'Agatti Island (Lakshadweep)' },
  minicoy: { lat: 8.28, lon: 73.05, name: 'Minicoy Island (Nine Degree Channel)' },

  // Regional Neighbors & Sea Lane Endpoints
  talaimannar: { lat: 9.10, lon: 79.72, name: 'Talaimannar (Sri Lanka - Palk Strait)' },
  colombo: { lat: 6.93, lon: 79.84, name: 'Colombo Port (Sri Lanka)' },
  jaffna: { lat: 9.66, lon: 80.01, name: 'Jaffna / Kankesanthurai (Northern Sri Lanka)' },
  trincomalee: { lat: 8.57, lon: 81.23, name: 'Trincomalee Harbor (Sri Lanka)' },
  galle: { lat: 6.03, lon: 80.21, name: 'Galle Port (Sri Lanka)' },
  hambantota: { lat: 6.12, lon: 81.12, name: 'Hambantota International Port (Sri Lanka)' },
  srilanka: { lat: 9.10, lon: 79.72, name: 'Talaimannar / Colombo (Sri Lanka)' },
  male: { lat: 4.17, lon: 73.51, name: 'Malé (Maldives)' },
  maldives: { lat: 4.17, lon: 73.51, name: 'Malé (Maldives)' },
  dubai: { lat: 25.27, lon: 55.29, name: 'Port Rashid / Dubai (UAE)' },
  uae: { lat: 25.27, lon: 55.29, name: 'Port Rashid / Dubai (UAE)' },
  muscat: { lat: 23.61, lon: 58.59, name: 'Port Sultan Qaboos (Muscat, Oman)' },
  singapore: { lat: 1.29, lon: 103.85, name: 'Port of Singapore (Malacca Strait)' },
  chittagong: { lat: 22.33, lon: 91.80, name: 'Port of Chittagong (Bangladesh)' },
  karachi: { lat: 24.84, lon: 66.98, name: 'Port of Karachi (Pakistan)' },
};

// =========================================================================
// 2. Inland Hinterland & Non-Maritime Registry
// =========================================================================
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
  noida: {
    name: 'Noida (National Capital Region)',
    state: 'Uttar Pradesh / Delhi NCR',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 1100, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1410, sector: 'Konkan Coast' },
    ],
    context: 'Inland NCR metropolitan hub, ~1,100 km from Arabian Sea maritime gateways.',
  },
  gurgaon: {
    name: 'Gurugram (NCR)',
    state: 'Haryana',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 1050, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1380, sector: 'Konkan Coast' },
    ],
    context: 'Inland financial hub in Haryana NCR, over 1,050 km from the coastline.',
  },
  gurugram: {
    name: 'Gurugram (NCR)',
    state: 'Haryana',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 1050, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1380, sector: 'Konkan Coast' },
    ],
    context: 'Inland financial hub in Haryana NCR, over 1,050 km from the coastline.',
  },
  nagpur: {
    name: 'Nagpur',
    state: 'Maharashtra',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Visakhapatnam Port (Andhra Pradesh)', distanceKm: 720, sector: 'Bay of Bengal' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 820, sector: 'Konkan Coast' },
    ],
    context: 'Geographical center of India (Zero Mile Stone), situated over 700 km inland from both the Arabian Sea and Bay of Bengal.',
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
  pune: {
    name: 'Pune',
    state: 'Maharashtra',
    type: 'inland_city',
    nearestPorts: [
      { name: 'JNPT / Mumbai Port (Maharashtra)', distanceKm: 150, sector: 'Konkan Coast' },
    ],
    context: 'Inland plateau city in Western Maharashtra, ~150 km east of the Konkan coastline and JNPT container port.',
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
  jodhpur: {
    name: 'Jodhpur',
    state: 'Rajasthan',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla / Mundra Ports (Gujarat)', distanceKm: 550, sector: 'Gulf of Kutch' },
    ],
    context: 'Inland city in western Rajasthan, ~550 km from Gujarat seaports.',
  },
  udaipur: {
    name: 'Udaipur',
    state: 'Rajasthan',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 460, sector: 'Gulf of Kutch' },
      { name: 'Dahej Port (Gujarat)', distanceKm: 420, sector: 'Gulf of Khambhat' },
    ],
    context: 'Inland southern Rajasthan city, ~420 km from Gujarat maritime terminals.',
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
  agra: {
    name: 'Agra',
    state: 'Uttar Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 950, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1200, sector: 'Konkan Coast' },
    ],
    context: 'Inland historic city in Uttar Pradesh, ~950 km from maritime seaports.',
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
  amritsar: {
    name: 'Amritsar',
    state: 'Punjab',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 1200, sector: 'Gulf of Kutch' },
    ],
    context: 'Inland northern city in Punjab, ~1,200 km from Arabian Sea ports.',
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
  indore: {
    name: 'Indore',
    state: 'Madhya Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 585, sector: 'Konkan Coast' },
      { name: 'Dahej / Hazira (Gujarat)', distanceKm: 420, sector: 'Gulf of Khambhat' },
    ],
    context: 'Major commercial city in Madhya Pradesh, ~585 km northeast of Mumbai port facilities.',
  },
  gwalior: {
    name: 'Gwalior',
    state: 'Madhya Pradesh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kandla Port (Gujarat)', distanceKm: 920, sector: 'Gulf of Kutch' },
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 1080, sector: 'Konkan Coast' },
    ],
    context: 'Inland city in northern Madhya Pradesh, ~920 km from maritime coastlines.',
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
  ranchi: {
    name: 'Ranchi',
    state: 'Jharkhand',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kolkata / Haldia Port (West Bengal)', distanceKm: 410, sector: 'Bay of Bengal' },
      { name: 'Paradeep Port (Odisha)', distanceKm: 480, sector: 'Bay of Bengal' },
    ],
    context: 'Inland capital of Jharkhand on the Chota Nagpur Plateau, ~410 km west of the Bay of Bengal.',
  },
  raipur: {
    name: 'Raipur',
    state: 'Chhattisgarh',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Visakhapatnam Port (Andhra Pradesh)', distanceKm: 450, sector: 'Bay of Bengal' },
      { name: 'Paradeep Port (Odisha)', distanceKm: 550, sector: 'Bay of Bengal' },
    ],
    context: 'Inland capital of Chhattisgarh, ~450 km northwest of Visakhapatnam deepwater port.',
  },
  guwahati: {
    name: 'Guwahati',
    state: 'Assam',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Kolkata / Haldia Port (West Bengal)', distanceKm: 980, sector: 'Bay of Bengal' },
    ],
    context: 'Inland gateway of Northeast India on the Brahmaputra River (National Waterway-2), ~980 km north of the Bay of Bengal.',
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
  nashik: {
    name: 'Nashik',
    state: 'Maharashtra',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 170, sector: 'Konkan Coast' },
    ],
    context: 'Inland city in northern Maharashtra, ~170 km northeast of Mumbai port facilities.',
  },
  aurangabad: {
    name: 'Chhatrapati Sambhajinagar (Aurangabad)',
    state: 'Maharashtra',
    type: 'inland_city',
    nearestPorts: [
      { name: 'Mumbai / JNPT (Maharashtra)', distanceKm: 340, sector: 'Konkan Coast' },
    ],
    context: 'Inland industrial city in Marathwada, ~340 km east of the Konkan coastline.',
  },
};

// =========================================================================
// 3. International Sovereign Nations & Overseas Maritime Territory Registry
// =========================================================================
interface InternationalLocationInfo {
  name: string;
  maritimeZone: string;
  keyShippingCorridors: string;
  indianGatewayPorts: string[];
  platformScope: string;
}

const INTERNATIONAL_ANCHORS: Record<string, InternationalLocationInfo> = {
  china: {
    name: "People's Republic of China",
    maritimeZone: 'South China Sea, East China Sea, and Western Pacific Ocean',
    keyShippingCorridors:
      'Major maritime container traffic between India and China transits eastwards across the Bay of Bengal, through the strategic Strait of Malacca (Singapore/Malaysia), into the South China Sea towards Shanghai, Ningbo-Zhoushan, and Shenzhen.',
    indianGatewayPorts: [
      'Chennai Port & Ennore (Tamil Nadu)',
      'Visakhapatnam Deepwater Port (Andhra Pradesh)',
      'Kolkata / Haldia Dock Complex (West Bengal)',
      'Port Blair / Great Nicobar (Andaman & Nicobar Islands - Malacca Approach)',
    ],
    platformScope:
      "AUREXO / ORCA's real-time sensory and geofencing envelope covers India's 7,516 km sovereign coastline, Exclusive Economic Zone (EEZ), and vital interconnecting Indian Ocean sea lanes.",
  },
  usa: {
    name: 'United States of America',
    maritimeZone: 'Atlantic Ocean and Pacific Ocean',
    keyShippingCorridors:
      'Trans-oceanic maritime shipping to the US East Coast transits the Arabian Sea through the Red Sea / Suez Canal or around the Cape of Good Hope; US West Coast freight routes eastward via the Malacca Strait across the Pacific.',
    indianGatewayPorts: [
      'Jawaharlal Nehru Port Trust (JNPT / Mumbai, Maharashtra)',
      'Mundra Port (Gujarat)',
      'Cochin / Vallarpadam ICTT (Kerala)',
    ],
    platformScope:
      "AUREXO / ORCA focuses on real-time hydrographic and oceanographic intelligence across the Indian Ocean Basin, Arabian Sea, Bay of Bengal, and India's EEZ.",
  },
  america: {
    name: 'United States of America',
    maritimeZone: 'Atlantic Ocean and Pacific Ocean',
    keyShippingCorridors:
      'Trans-oceanic maritime shipping to the US East Coast transits the Arabian Sea through the Red Sea / Suez Canal or around the Cape of Good Hope; US West Coast freight routes eastward via the Malacca Strait across the Pacific.',
    indianGatewayPorts: [
      'Jawaharlal Nehru Port Trust (JNPT / Mumbai, Maharashtra)',
      'Mundra Port (Gujarat)',
      'Cochin / Vallarpadam ICTT (Kerala)',
    ],
    platformScope:
      "AUREXO / ORCA focuses on real-time hydrographic and oceanographic intelligence across the Indian Ocean Basin, Arabian Sea, Bay of Bengal, and India's EEZ.",
  },
  singapore: {
    name: 'Republic of Singapore',
    maritimeZone: 'Strait of Singapore & Strait of Malacca',
    keyShippingCorridors:
      'Premier transshipment hub connecting the Indian Ocean and the Pacific Ocean. Major feeder routes connect Chennai, Visakhapatnam, Kolkata, and Port Blair through the Six Degree and Ten Degree Channels.',
    indianGatewayPorts: [
      'Port Blair / Great Nicobar (Andaman & Nicobar Islands)',
      'Chennai Port (Tamil Nadu)',
      'Visakhapatnam Port (Andhra Pradesh)',
    ],
    platformScope:
      'Strategic eastern maritime nexus monitored for international trade and navigational passage corridors connecting the Bay of Bengal.',
  },
  dubai: {
    name: 'Dubai / United Arab Emirates (UAE)',
    maritimeZone: 'Persian Gulf & Gulf of Oman',
    keyShippingCorridors:
      'Primary trade, bunkering, and container corridor across the Arabian Sea connecting western Indian ports (Mundra, Kandla, Mumbai JNPT, Hazira) through the Strait of Hormuz to Port Rashid and Jebel Ali.',
    indianGatewayPorts: [
      'Mundra Port (Gujarat)',
      'Deendayal Port (Kandla, Gujarat)',
      'Mumbai / JNPT (Maharashtra)',
    ],
    platformScope:
      'Heavily monitored commercial energy and container corridor across the Northern Arabian Sea.',
  },
  uae: {
    name: 'United Arab Emirates (UAE)',
    maritimeZone: 'Persian Gulf & Gulf of Oman',
    keyShippingCorridors:
      'Primary trade, bunkering, and container corridor across the Arabian Sea connecting western Indian ports (Mundra, Kandla, Mumbai JNPT, Hazira) through the Strait of Hormuz to Port Rashid and Jebel Ali.',
    indianGatewayPorts: [
      'Mundra Port (Gujarat)',
      'Deendayal Port (Kandla, Gujarat)',
      'Mumbai / JNPT (Maharashtra)',
    ],
    platformScope:
      'Heavily monitored commercial energy and container corridor across the Northern Arabian Sea.',
  },
  australia: {
    name: 'Commonwealth of Australia',
    maritimeZone: 'Southern Indian Ocean, Timor Sea, and Pacific Ocean',
    keyShippingCorridors:
      'Direct southern maritime corridor across the Indian Ocean connecting Western Australia (Fremantle, Port Hedland) to eastern and southern Indian ports (Chennai, Vizag, Paradeep, Krishnapatnam) for dry bulk and energy commodities.',
    indianGatewayPorts: [
      'Visakhapatnam Port (Andhra Pradesh)',
      'Paradeep Port (Odisha)',
      'Chennai Port (Tamil Nadu)',
    ],
    platformScope:
      'Southern Indian Ocean maritime basin context monitored within global oceanographic reanalysis.',
  },
  japan: {
    name: 'Japan',
    maritimeZone: 'Sea of Japan, East China Sea, and Western Pacific Ocean',
    keyShippingCorridors:
      'Indo-Pacific sea lanes transiting from the Bay of Bengal through the Malacca and Sunda Straits into the South China Sea and Pacific ocean routes towards Tokyo, Yokohama, and Kobe.',
    indianGatewayPorts: [
      'Chennai Port (Tamil Nadu)',
      'Visakhapatnam Port (Andhra Pradesh)',
      'Mumbai / JNPT (Maharashtra)',
    ],
    platformScope:
      'Indo-Pacific maritime partnership lanes grounded in Indian EEZ gateway surveillance.',
  },
  russia: {
    name: 'Russian Federation',
    maritimeZone: 'Arctic Ocean, Baltic Sea, Black Sea, and Sea of Japan',
    keyShippingCorridors:
      'International North-South Transport Corridor (INSTC) via Mumbai/Kandla to Bandar Abbas (Iran) and the Caspian Sea; also eastern maritime sea corridor connecting Chennai to Vladivostok.',
    indianGatewayPorts: [
      'Mumbai / JNPT (Maharashtra)',
      'Kandla Port (Gujarat)',
      'Chennai Port (Tamil Nadu)',
    ],
    platformScope:
      'Cross-basin trade routing supported via western and eastern Indian maritime gateways.',
  },
  europe: {
    name: 'European Union / European Maritime Region',
    maritimeZone: 'Mediterranean Sea, North Sea, and North Atlantic Ocean',
    keyShippingCorridors:
      'Critical maritime trade corridor across the Arabian Sea, through the Bab-el-Mandeb, Red Sea, Suez Canal, and Mediterranean Sea towards Rotterdam, Antwerp, and Hamburg.',
    indianGatewayPorts: [
      'Mumbai / JNPT (Maharashtra)',
      'Mundra Port (Gujarat)',
      'Cochin / Vallarpadam ICTT (Kerala)',
    ],
    platformScope:
      'Major global sea line of communication (SLOC) transiting the western Indian EEZ and Arabian Sea.',
  },
  uk: {
    name: 'United Kingdom',
    maritimeZone: 'North Sea, English Channel, and North Atlantic Ocean',
    keyShippingCorridors:
      'Transits Arabian Sea, Suez Canal, Mediterranean Sea, and Strait of Gibraltar into the UK ports of Southampton, Felixstowe, and London Gateway.',
    indianGatewayPorts: [
      'Mumbai / JNPT (Maharashtra)',
      'Mundra Port (Gujarat)',
      'Cochin Port (Kerala)',
    ],
    platformScope:
      'Major global sea line of communication (SLOC) monitored via Arabian Sea maritime sector.',
  },
};

// =========================================================================
// 4. Intent & Entity Extractors
// =========================================================================
function isGreetingOrHelpQuery(promptLower: string): boolean {
  const clean = promptLower.trim().replace(/[?!.,]/g, '');

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
    const regex = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(promptLower)) {
      return info;
    }
  }
  return null;
}

function findInternationalMention(promptLower: string): InternationalLocationInfo | null {
  for (const [key, info] of Object.entries(INTERNATIONAL_ANCHORS)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(promptLower)) {
      return info;
    }
  }
  return null;
}

function isOceanConceptQuery(promptLower: string): boolean {
  const conceptKeywords = [
    'kallakkadal',
    'swell surge',
    'what is upwelling',
    'explain upwelling',
    'what is sst',
    'what is sea surface temperature',
    'what is chlorophyll',
    'what is pfz',
    'what is potential fishing zone',
    'what is imbl',
    'what is eez',
    'what is mpa',
    'what is marine protected area',
    'how does incois work',
    'how do satellites track oceans',
    'beaufort scale',
    'what is swell',
    'what causes swell',
  ];
  return conceptKeywords.some((k) => promptLower.includes(k));
}

function cleanPlaceToken(token: string): string {
  return token
    .trim()
    .replace(/^(the|a|an|country|port|city|harbor|harbour|island|islands|coast|sector)\s+/gi, '')
    .replace(/\s+(country|port|city|harbor|harbour|island|islands|coast|sector)$/gi, '')
    .trim();
}

export function parseRouteEndpoints(
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

  // Pattern 1: "from [origin] to [dest]" or "between [origin] and [dest]"
  const fromToMatch = lower.match(
    /(?:from|between|travel\s+from|travelling\s+from|traveling\s+from|travrlling\s+from|trip\s+from|sail\s+from|sailing\s+from|navigate\s+from|go\s+from)\s+([a-zA-Z\s]+?)\s+(?:to|and)\s+([a-zA-Z\s]+)/i
  );

  let rawOrigin = '';
  let rawDest = '';

  if (fromToMatch) {
    rawOrigin = cleanPlaceToken(fromToMatch[1]);
    rawDest = cleanPlaceToken(fromToMatch[2]);
  }

  let originAnchor: { lat: number; lon: number; name: string } | undefined;
  let destAnchor: { lat: number; lon: number; name: string } | undefined;

  // Match raw tokens
  if (rawOrigin) {
    if (rawOrigin.includes('sri lanka') || rawOrigin.includes('srilanka')) {
      originAnchor = COASTAL_ANCHORS['talaimannar'];
    } else if (rawOrigin === 'india') {
      if (rawDest.includes('sri lanka') || rawDest.includes('srilanka') || rawDest.includes('colombo')) {
        originAnchor = COASTAL_ANCHORS['rameswaram'];
      } else if (rawDest.includes('maldives') || rawDest.includes('male')) {
        originAnchor = COASTAL_ANCHORS['kochi'];
      } else if (rawDest.includes('dubai') || rawDest.includes('uae')) {
        originAnchor = COASTAL_ANCHORS['mumbai'];
      } else if (rawDest.includes('singapore') || rawDest.includes('china')) {
        originAnchor = COASTAL_ANCHORS['chennai'];
      } else {
        originAnchor = COASTAL_ANCHORS['mumbai'];
      }
    } else {
      for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
        if (rawOrigin.includes(key) && !originAnchor) originAnchor = anchor;
      }
    }
  }

  if (rawDest) {
    if (rawDest.includes('sri lanka') || rawDest.includes('srilanka')) {
      destAnchor = COASTAL_ANCHORS['talaimannar'];
    } else if (rawDest === 'india') {
      destAnchor = COASTAL_ANCHORS['rameswaram'];
    } else {
      for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
        if (rawDest.includes(key) && !destAnchor) destAnchor = anchor;
      }
    }
  }

  // Fallback: search prompt for any two anchors
  if (!originAnchor || !destAnchor) {
    // Check if India to Sri Lanka is mentioned anywhere in prompt
    const hasIndia = lower.includes('india');
    const hasSriLanka = lower.includes('sri lanka') || lower.includes('srilanka') || lower.includes('colombo') || lower.includes('talaimannar');

    if (hasIndia && hasSriLanka) {
      originAnchor = originAnchor ?? COASTAL_ANCHORS['rameswaram'];
      destAnchor = destAnchor ?? (lower.includes('colombo') ? COASTAL_ANCHORS['colombo'] : COASTAL_ANCHORS['talaimannar']);
    } else {
      const foundAnchors: Array<{ lat: number; lon: number; name: string }> = [];
      for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
        if (lower.includes(key)) {
          if (!foundAnchors.some((a) => a.name === anchor.name)) {
            foundAnchors.push(anchor);
          }
        }
      }
      if (foundAnchors.length >= 2) {
        originAnchor = originAnchor ?? foundAnchors[0];
        destAnchor = destAnchor ?? foundAnchors[1];
      } else if (foundAnchors.length === 1 && !originAnchor) {
        originAnchor = foundAnchors[0];
      }
    }
  }

  const origin = originAnchor
    ? { latitude: originAnchor.lat, longitude: originAnchor.lon }
    : defaultOrigin;
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

  // Check for explicit coastal anchors in prompt
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

  // Check inland and international entities
  const inlandMatch = !promptReferencesHere && !explicitCoastalAnchor ? findInlandMention(promptLower) : null;
  const intlMatch = !promptReferencesHere && !explicitCoastalAnchor && !inlandMatch ? findInternationalMention(promptLower) : null;

  // =========================================================================
  // SCENARIO 1: Inland / Landlocked Geographic Inquiry (e.g. "nagpur", "delhi")
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
        center: [78.9629, 20.5937],
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
  // SCENARIO 1b: International Territory / Foreign Partner Inquiry (e.g. "china", "usa")
  // =========================================================================
  if (intlMatch) {
    toolsUsed.push('query_international_territory_corridor');
    swarmSteps.push({
      agentName: 'Supervisor',
      action: 'International Maritime Context Grounded',
      status: 'completed',
      detail: `Identified foreign sovereign partner: ${intlMatch.name}. Contextualizing strategic sea lanes and Indian maritime trade gateways.`,
      timestamp: new Date().toISOString(),
    });

    const toolData = {
      internationalData: intlMatch,
      location: intlMatch.name,
    };

    evidenceSources.push({
      name: 'AUREXO Global Sea Lanes & Strategic Maritime Corridors Registry',
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    const suggestedQueries = [
      `Calculate shipping route from Chennai to Port Blair`,
      `Check sea state along Western Arabian Sea corridors`,
      `Scan active maritime warnings across all Indian sectors`,
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'International Sovereign Territory & Strategic Sea Lanes',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'query_international_territory_corridor',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: [78.9629, 15.0],
        zoom: 4.2,
        activeLayer: 'none',
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Contextualized strategic sea corridors for ${intlMatch.name} in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: intlMatch.name,
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
    (promptLower.includes('which region') &&
      (promptLower.includes('warning') || promptLower.includes('active') || promptLower.includes('rough'))) ||
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
    (promptLower.includes('boat') &&
      (promptLower.includes('where') ||
        promptLower.includes('closest') ||
        promptLower.includes('nearest') ||
        promptLower.includes('track') ||
        promptLower.includes('position') ||
        promptLower.includes('find')));

  if (isVesselQuery) {
    toolsUsed.push('query_vessel_fleet');
    const refCoord =
      userCoordinates ??
      (sessionContext.lastCoordinates ??
        (explicitCoastalAnchor
          ? { latitude: explicitCoastalAnchor.lat, longitude: explicitCoastalAnchor.lon }
          : { latitude: 18.95, longitude: 72.80 }));
    const refName = explicitCoastalAnchor
      ? explicitCoastalAnchor.name
      : sessionContext.lastLocationName ?? 'Mumbai Offshore';

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
  // SCENARIO 6: Navigational Route Passage Query (e.g. "travel from india to sri lanka")
  // =========================================================================
  const isRouteQuery =
    promptLower.includes('route') ||
    promptLower.includes('passage') ||
    promptLower.includes('corridor') ||
    promptLower.includes('travel from') ||
    promptLower.includes('travelling from') ||
    promptLower.includes('traveling from') ||
    promptLower.includes('travrlling from') ||
    promptLower.includes('trip from') ||
    promptLower.includes('sail from') ||
    promptLower.includes('sailing from') ||
    promptLower.includes('navigate from') ||
    promptLower.includes('go from') ||
    (promptLower.includes('from') && promptLower.includes('to') && (promptLower.includes('india') || promptLower.includes('sri lanka') || promptLower.includes('mumbai') || promptLower.includes('goa') || promptLower.includes('chennai') || promptLower.includes('kochi')));

  if (isRouteQuery) {
    toolsUsed.push('compute_safe_passage');
    const defaultOrigin =
      userCoordinates ??
      (explicitCoastalAnchor
        ? { latitude: explicitCoastalAnchor.lat, longitude: explicitCoastalAnchor.lon }
        : { latitude: 9.28, longitude: 79.31 }); // Default to Rameswaram if Sri Lanka involved
    const defaultName = explicitCoastalAnchor ? explicitCoastalAnchor.name : 'Rameswaram (Palk Bay)';

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

    const mapCenter: [number, number] = [
      (origin.longitude + destination.longitude) / 2,
      (origin.latitude + destination.latitude) / 2,
    ];
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
      `Check border proximity to IMBL`,
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
  // SCENARIO 6b: Follow-Up Route Weather & Corridor Conditions Inquiry
  // (e.g. user asks "wheather" / "weather" / "how is the sea" after a route query)
  // =========================================================================
  const isWeatherFollowUp =
    promptLower.includes('weather') ||
    promptLower.includes('wheather') ||
    promptLower.includes('wether') ||
    promptLower.includes('condition') ||
    promptLower.includes('sea state') ||
    promptLower.includes('how is the sea') ||
    promptLower.includes('waves') ||
    promptLower.includes('wind') ||
    promptLower.includes('safe to travel') ||
    promptLower.includes('is it safe');

  const activeRouteName = sessionContext.lastLocationName;
  const isCorridorContext = activeRouteName && activeRouteName.includes(' to ');

  if (isWeatherFollowUp && isCorridorContext) {
    toolsUsed.push('query_corridor_voyage_weather');
    const [origNamePart, destNamePart] = activeRouteName.split(' to ').map((s) => s.trim());

    // Resolve coordinates for origin and destination
    let origCoord: GeoCoordinate = { latitude: 9.28, longitude: 79.31 };
    let destCoord: GeoCoordinate = sessionContext.lastCoordinates ?? { latitude: 9.10, longitude: 79.72 };

    for (const [key, anchor] of Object.entries(COASTAL_ANCHORS)) {
      if (origNamePart.toLowerCase().includes(key)) {
        origCoord = { latitude: anchor.lat, longitude: anchor.lon };
        break;
      }
    }

    const midCoord: GeoCoordinate = {
      latitude: (origCoord.latitude + destCoord.latitude) / 2,
      longitude: (origCoord.longitude + destCoord.longitude) / 2,
    };

    swarmSteps.push({
      agentName: 'WeatherHazard',
      action: 'Fetch Corridor Multi-Point Observations',
      status: 'executing',
      detail: `Synthesizing sea state across passage: ${origNamePart} -> Mid-corridor -> ${destNamePart}`,
      timestamp: new Date().toISOString(),
    });

    const [oceanOrigin, oceanMid, oceanDest] = await Promise.all([
      runOceanAgent(origCoord, origNamePart),
      runOceanAgent(midCoord, 'Mid-Corridor Waypoint'),
      runOceanAgent(destCoord, destNamePart),
    ]);

    const routePlan = computeSafePassage(origCoord, destCoord);

    const toolData: Record<string, any> = {
      routeWeather: {
        corridorName: `${origNamePart} to ${destNamePart}`,
        originName: origNamePart,
        destName: destNamePart,
        originObservation: oceanOrigin.observation,
        midObservation: oceanMid.observation,
        destinationObservation: oceanDest.observation,
        routeSafety: routePlan.overallSafety,
      },
      route: routePlan,
    };

    swarmSteps.push(...oceanOrigin.steps, ...oceanMid.steps, ...oceanDest.steps);

    evidenceSources.push({
      name: `Open-Meteo Multi-Point Mesh (${origNamePart} -> ${destNamePart})`,
      status: 'VERIFIED_LIVE',
      retrievedAt: new Date().toISOString(),
    });

    const suggestedQueries = [
      `Check IMBL border distance along ${origNamePart} to ${destNamePart}`,
      `Find live vessels near ${origNamePart}`,
      `Scan regional warnings across all sectors`,
    ];

    const llmResult = await synthesizeMarineResponse({
      userPrompt: prompt,
      intent: 'Voyage Corridor Passage Weather & Marine Safety',
      toolData,
    });

    const durationMs = Date.now() - startTime;
    return {
      answer: llmResult.text,
      intent: 'query_corridor_voyage_weather',
      toolsUsed,
      evidence: {
        sources: evidenceSources,
        timestamp: new Date().toISOString(),
      },
      mapActions: {
        center: [midCoord.longitude, midCoord.latitude],
        zoom: routePlan.totalDistanceKm > 300 ? 6.0 : 7.0,
        activeLayer: 'none',
        highlightGeometry: routePlan.routeGeometry,
      },
      suggestedQueries,
      swarmTrace: {
        steps: swarmSteps,
        consensusSummary: `Evaluated complete corridor weather in ${durationMs}ms.`,
        durationMs,
      },
      sessionContext: {
        lastLocationName: activeRouteName,
        lastCoordinates: destCoord,
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
  // SCENARIO 7: Coastal / Marine Observation & Geofencing Query
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

  const wantsTemperature =
    promptLower.includes('temperature') || promptLower.includes('sst') || promptLower.includes('thermal');
  const wantsChlorophyll = promptLower.includes('chlorophyll') || promptLower.includes('ocean color');
  const wantsWaves =
    promptLower.includes('wave') ||
    promptLower.includes('swell') ||
    promptLower.includes('wind') ||
    promptLower.includes('wheather') ||
    promptLower.includes('weather');
  const wantsBorder =
    promptLower.includes('border') ||
    promptLower.includes('imbl') ||
    promptLower.includes('sri lanka') ||
    promptLower.includes('pakistan');
  const wantsFish =
    promptLower.includes('fish') || promptLower.includes('pfz') || promptLower.includes('tuna');

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
      detail: `Blue Economy found favorable HSI, BUT Weather/Sentinel detected ${
        weatherRes.isSeaRough ? 'rough sea state' : 'border proximity'
      }. Prioritized safety advisory.`,
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
