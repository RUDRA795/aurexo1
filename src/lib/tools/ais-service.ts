/**
 * Aurexo Real-Time AIS Ingestion Service
 * Connects server-side to AISStream WebSocket API.
 * Subscribes to the Indian Maritime EEZ bounding box.
 * Normalizes live PositionReport and ShipStaticData messages into MarineVessel domain objects.
 * Strictly maintains real-data provenance: no fake/simulated vessels are marked as LIVE_AIS.
 */

import { MarineVessel, VesselType, VesselSourceStatus } from '../types/vessel';

export interface AisServiceStatus {
  connected: boolean;
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'UNAVAILABLE';
  lastMessageTime: string | null;
  vesselsCount: number;
  error?: string;
}

interface AisStreamMessage {
  MessageType: string;
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      Cog?: number;
      Sog?: number;
      TrueHeading?: number;
      Latitude?: number;
      Longitude?: number;
    };
    ShipStaticData?: {
      Name?: string;
      CallSign?: string;
      Type?: number;
      Dimension?: {
        A?: number;
        B?: number;
        C?: number;
        D?: number;
      };
      MaximumStaticDraught?: number;
      Destination?: string;
    };
  };
}

class AisStreamManager {
  private ws: any = null;
  private vesselCache: Map<string, MarineVessel> = new Map();
  private status: AisServiceStatus['status'] = 'DISCONNECTED';
  private lastMessageTime: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private apiKey: string = '';

  constructor() {
    this.resolveApiKey();
    this.init();
  }

  private resolveApiKey(): string {
    const key =
      process.env.AISSTREAM_API_KEY ||
      process.env.AIS_API_KEY ||
      process.env['ais api key'] ||
      '';
    this.apiKey = key.trim();
    return this.apiKey;
  }

  public init() {
    if (this.isConnecting || (this.ws && this.status === 'CONNECTED')) {
      return;
    }

    const key = this.resolveApiKey();
    if (!key) {
      this.status = 'UNAVAILABLE';
      return;
    }

    if (typeof globalThis.WebSocket === 'undefined') {
      this.status = 'UNAVAILABLE';
      return;
    }

    this.connect();
  }

  private connect() {
    try {
      this.isConnecting = true;
      this.status = 'CONNECTING';

      const ws = new globalThis.WebSocket('wss://stream.aisstream.io/v0/stream');
      this.ws = ws;

      ws.onopen = () => {
        this.status = 'CONNECTED';
        this.isConnecting = false;

        // Subscribe to Indian Maritime Sector:
        // Lat: 0.0°N to 26.0°N, Lon: 60.0°E to 96.0°E
        const subMsg = {
          Apikey: this.apiKey,
          BoundingBoxes: [
            [[0.0, 60.0], [26.0, 96.0]]
          ],
          FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
        };

        try {
          ws.send(JSON.stringify(subMsg));
        } catch (e) {
          console.error('[Aurexo AIS] Failed to send subscription:', e);
        }
      };

      ws.onmessage = async (event: any) => {
        try {
          let text = '';
          if (typeof event.data === 'string') {
            text = event.data;
          } else if (event.data && typeof event.data.text === 'function') {
            text = await event.data.text();
          } else if (event.data) {
            text = event.data.toString('utf8');
          }

          if (!text) return;
          const msg: AisStreamMessage = JSON.parse(text);

          if (msg.MessageType === 'SubscriptionConfirmation') {
            return;
          }

          this.handleAisMessage(msg);
        } catch {
          // Ignore transient malformed packets
        }
      };

      ws.onerror = (_err: any) => {
        this.status = 'DISCONNECTED';
      };

      ws.onclose = () => {
        this.status = 'DISCONNECTED';
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch {
      this.status = 'UNAVAILABLE';
      this.isConnecting = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init();
    }, 15000);
  }

  private mapShipType(typeCode?: number): VesselType {
    if (!typeCode) return 'Cargo / Tanker';
    if (typeCode >= 30 && typeCode <= 39) return 'Deep-Sea Trawler';
    if (typeCode === 52 || typeCode === 55) return 'Coast Guard Patrol';
    if (typeCode === 51) return 'Research Vessel';
    if (typeCode >= 80 && typeCode <= 89) return 'Cargo / Tanker';
    if (typeCode >= 70 && typeCode <= 79) return 'Cargo / Tanker';
    return 'Artisanal Fishing';
  }

  private handleAisMessage(msg: AisStreamMessage) {
    const meta = msg.MetaData;
    const pos = msg.Message?.PositionReport;
    const stat = msg.Message?.ShipStaticData;

    const mmsi = meta?.MMSI ? String(meta.MMSI) : '';
    if (!mmsi) return;

    const lat = pos?.Latitude ?? meta?.latitude;
    const lon = pos?.Longitude ?? meta?.longitude;

    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
      return;
    }

    // Bounds safety: check within reasonable maritime bounds
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return;
    }

    const now = new Date();
    this.lastMessageTime = now.toISOString();

    const existing = this.vesselCache.get(mmsi);

    const rawHeading = pos?.TrueHeading ?? pos?.Cog ?? existing?.headingDegrees ?? 0;
    const heading = rawHeading === 511 ? (pos?.Cog ?? 0) : rawHeading;

    const shipName = meta?.ShipName?.trim() || stat?.Name?.trim() || existing?.name || `MMSI-${mmsi}`;
    const callsign = stat?.CallSign?.trim() || existing?.callsign || `AIS-${mmsi.slice(-4)}`;
    const destination = stat?.Destination?.trim() || existing?.destination || 'Indian Coastal Waters';
    const vesselType = stat?.Type ? this.mapShipType(stat.Type) : (existing?.vesselType || 'Cargo / Tanker');

    const draft = stat?.MaximumStaticDraught ?? existing?.draftMeters ?? 4.5;
    const dim = stat?.Dimension;
    const length = dim ? ((dim.A ?? 0) + (dim.B ?? 0)) || existing?.lengthMeters || 60 : existing?.lengthMeters || 60;

    const vessel: MarineVessel = {
      id: `AIS-${mmsi}`,
      mmsi,
      name: shipName,
      callsign,
      vesselType,
      coordinates: { latitude: lat, longitude: lon },
      headingDegrees: Math.round(heading),
      speedKnots: Math.round((pos?.Sog ?? existing?.speedKnots ?? 0) * 10) / 10,
      destination,
      draftMeters: Math.round(draft * 10) / 10,
      lengthMeters: Math.round(length),
      lastUpdated: this.lastMessageTime,
      sourceStatus: 'LIVE_AIS',
      notes: `Real-time AIS position report received via AISStream. Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}.`,
    };

    this.vesselCache.set(mmsi, vessel);

    // Keep cache bounded to recent 300 active vessels
    if (this.vesselCache.size > 300) {
      const oldestKey = this.vesselCache.keys().next().value;
      if (oldestKey) this.vesselCache.delete(oldestKey);
    }
  }

  public getLiveVessels(): MarineVessel[] {
    const now = Date.now();
    const result: MarineVessel[] = [];

    for (const vessel of this.vesselCache.values()) {
      const ageMs = now - new Date(vessel.lastUpdated).getTime();
      // If older than 45 minutes, mark as STALE
      if (ageMs > 45 * 60 * 1000) {
        result.push({
          ...vessel,
          sourceStatus: 'STALE' as VesselSourceStatus,
        });
      } else {
        result.push(vessel);
      }
    }

    return result;
  }

  public getStatus(): AisServiceStatus {
    return {
      connected: this.status === 'CONNECTED',
      status: this.status,
      lastMessageTime: this.lastMessageTime,
      vesselsCount: this.vesselCache.size,
    };
  }
}

// Attach singleton to globalThis to survive Next.js module re-evaluations
const GLOBAL_AIS_KEY = '__aurexo_ais_singleton__';

export function getAisManager(): AisStreamManager {
  const g = globalThis as unknown as Record<string, AisStreamManager | undefined>;
  if (!g[GLOBAL_AIS_KEY]) {
    g[GLOBAL_AIS_KEY] = new AisStreamManager();
  }
  return g[GLOBAL_AIS_KEY]!;
}

export function getRealTimeAisVessels(): MarineVessel[] {
  const manager = getAisManager();
  manager.init();
  return manager.getLiveVessels();
}

export function getRealTimeAisStatus(): AisServiceStatus {
  const manager = getAisManager();
  return manager.getStatus();
}
