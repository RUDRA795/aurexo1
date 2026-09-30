# AUREXO REAL-TIME MAP POINT INTELLIGENCE AUDIT & BLUEPRINT

**Generated:** 2026-09-30  
**Status:** ARCHITECTURAL AUDIT & IMPLEMENTATION BLUEPRINT  
**Target:** Aurexo Marine Intelligence Platform  
**Guideline Compliance:** SIH PS-176 | Zero-Mock Guarantee | Frozen Frontend Blueprint

---

## 1. Executive Summary

This document establishes the comprehensive technical audit and architectural blueprint for implementing **Real-Time Map Point Intelligence** across the Aurexo Marine Intelligence Platform.

When a user clicks or taps anywhere on the interactive marine map:
1. A selected-coordinate marker is anchored at the exact clicked latitude and longitude.
2. A compact, premium intelligence popup appears anchored to the point.
3. The popup renders **100% verified real data** (Atmospheric Weather, Marine Sea State, Real AIS Vessel Proximity, Spatial Geofencing, and Deterministic Safety Scoring).
4. An **"ASK AUREXO"** button instantly opens the existing `ChatDrawer`, routes the exact coordinate and context into the Supervisor Agent Swarm, and enables conversational follow-up questions referencing the selected location.
5. If any data field or provider is unavailable, it is explicitly rendered as `UNAVAILABLE` with reason and freshness metadata. **Zero fake, mock, simulated, or demo values are ever permitted.**

---

## 2. Current Architecture Inventory & Reusability Audit

| Component / Subsystem | Current State | Reusability Assessment | Required Modifications |
| :--- | :--- | :--- | :--- |
| **MapLibre Click Handling (`MarineMap.tsx`)** | Captures `(e.lngLat)` and invokes `onCoordinateClick` callback | **REUSE & EXTEND** | Add interactive point popup with loading state, real data metrics, and "Ask Aurexo" button. |
| **Coordinate Marker (`MarineMap.tsx`)** | Renders pulsing marker at `selectedCoordinate` | **REUSE** | Anchor MapLibre `Popup` to the marker or clicked coordinate. |
| **Marine Conditions Service (`marine.service.ts`)** | Fetches Open-Meteo marine observations with 5-min LRU cache | **REUSE** | Integrates into unified `PointIntelligenceService`. |
| **Weather Adapter (`open-meteo.ts`)** | `OpenMeteoWeatherAdapter` fetches wind & temperature | **EXTEND** | Add `apparent_temperature`, `relative_humidity_2m`, and `precipitation` parameters supported by Open-Meteo. |
| **Marine Adapter (`open-meteo.ts`)** | `OpenMeteoMarineAdapter` fetches waves, currents, SST | **EXTEND** | Add `swell_wave_height`, `swell_wave_direction`, `swell_wave_period` parameters. |
| **AIS Stream Provider (`ais-stream.ts`)** | WebSocket client receiving real-time AIS messages via AISStream | **REUSE** | Keep strictly server-side. |
| **Vessel Service (`vessel.service.ts`)** | In-memory fleet registry combining baseline + live AIS | **EXTEND** | Add `findNearbyLiveAisVessels(coord, radiusKm)` returning **ONLY** verified `LIVE_AIS` vessels (strictly zero baseline/simulated vessels in point intelligence). |
| **Geospatial Boundaries (`boundaries.ts`)** | Turf.js point-in-polygon (MPA) and point-to-line (IMBL) | **REUSE** | Direct deterministic calculation for India EEZ, IMBL distance, and MPA containment. |
| **Region Service (`region.service.ts`)** | 9 Indian coastal sectors with metadata and center coords | **REUSE & EXTEND** | Add `findNearestRegion(coord)` using Turf spherical distance. |
| **Safety Engine (`safety.service.ts`)** | Deterministic 0–100 composite safety score & risk level | **REUSE** | Evaluates real multi-factor safety at the exact coordinate. |
| **Supervisor Agent Swarm (`supervisor.ts`)** | Multi-agent orchestrator with context and tool dispatch | **EXTEND** | Add explicit `point_intelligence` intent resolution for queries about "here", "this point", or clicked coordinates. |
| **Chat Drawer (`ChatDrawer.tsx`)** | Conversational UI communicating with `/api/agent/query` | **EXTEND** | Add trigger capability from map popup ("Ask Aurexo"), prefilling or executing coordinate inquiry. |
| **API Gateway (`/api/marine/point`)** | Does not exist | **NEW** | Implement `GET /api/marine/point?lat={lat}&lon={lon}` returning canonical `PointIntelligenceDTO`. |

---

## 3. Mock & Simulated Code Audit (Phase 14 Classification)

A comprehensive audit of the entire codebase was conducted for `mock`, `fake`, `dummy`, `simulated`, `sample`, and `demo`.

| Location | Pattern / Occurrence | Classification | Rationale & Action |
| :--- | :--- | :--- | :--- |
| `src/app/about/page.tsx:187` | "No mock data. Every number shown..." | **IGNORE** | User-facing documentation describing zero-mock integrity. |
| `src/app/page.tsx:251` | "verified live data, no mock" | **IGNORE** | Marketing / landing page documentation. |
| `src/lib/types/vessel.ts:10` | `'SIMULATED_TEST'` type | **KEEP** | Type definition used in test fixtures. |
| `src/lib/services/vessel.service.ts:31` | `BASELINE_FLEET` (6 Indian vessels) | **BYPASS FOR POINT INTEL** | Labeled `USER_REGISTERED` for the fleet page / unit tests. **Point Intelligence will query exclusively `LIVE_AIS` vessels** from the real AISStream buffer. If no live vessels are within range, return `NO_LIVE_DATA`. |

---

## 4. Canonical Point Intelligence Domain Architecture

```
User Click (MapLibre)
         ↓
GET /api/marine/point?lat={lat}&lon={lon}
         ↓
PointIntelligenceService
 ┌───────────────────────┼───────────────────────┐
 │                       │                       │
 ▼                       ▼                       ▼
OpenMeteoWeatherAdapter  OpenMeteoMarineAdapter  VesselService (Live AIS Only)
(Temp, Humidity, Wind)   (Waves, Swell, SST)     (Filtered to radiusKm)
 │                       │                       │
 └───────────────────────┼───────────────────────┘
                         ▼
        Geospatial Engine (`boundaries.ts` & `region.service.ts`)
        (Nearest Region, IMBL Distance, MPA Containment)
                         ▼
        Deterministic Safety Engine (`safety.service.ts`)
        (Composite Risk Score: 0-100, Risk Level, Directives)
                         ▼
        Canonical PointIntelligence Object (DTO)
         ├── Rendered in Compact MapLibre Popup
         └── Ingested into Supervisor Agent Swarm upon "ASK AUREXO"
```

### Data Contract: `PointIntelligenceDTO`

```typescript
export interface PointIntelligenceDTO {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
  location: {
    regionId?: string;
    regionName: string;
    sea?: string;
    state?: string;
    distanceToCoastKm?: number;
    spatialContext: string;
  };
  weather: {
    status: 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';
    temperatureCelsius?: number;
    apparentTemperatureCelsius?: number;
    relativeHumidityPercent?: number;
    windSpeedKmh?: number;
    windDirectionDegrees?: number;
    windGustsKmh?: number;
    surfacePressureHpa?: number;
    precipitationMm?: number;
    beaufortScale?: number;
    beaufortDescription?: string;
    weatherCode?: number;
    source: DataProvenance;
  };
  marine: {
    status: 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';
    waveHeightMeters?: number;
    waveDirectionDegrees?: number;
    wavePeriodSeconds?: number;
    waveCategory?: string;
    swellHeightMeters?: number;
    swellDirectionDegrees?: number;
    swellPeriodSeconds?: number;
    seaSurfaceTemperatureCelsius?: number;
    currentVelocityKmh?: number;
    currentDirectionDegrees?: number;
    isSafeForSmallCraft?: boolean;
    advisoryText?: string;
    source: DataProvenance;
  };
  vessels: {
    status: 'LIVE' | 'NO_LIVE_DATA' | 'UNAVAILABLE';
    nearbyCount: number;
    searchRadiusKm: number;
    nearby: Array<{
      mmsi: string;
      name: string;
      vesselType: string;
      distanceKm: number;
      distanceNauticalMiles: number;
      bearingDegrees: number;
      speedKnots: number;
      headingDegrees: number;
      sourceStatus: string;
      lastUpdated: string;
    }>;
    nearest?: {
      mmsi: string;
      name: string;
      vesselType: string;
      distanceKm: number;
      distanceNauticalMiles: number;
      bearingDegrees: number;
    };
    source: DataProvenance;
  };
  spatial: {
    regionName: string;
    isInsideEEZ: boolean;
    distanceToIMBLKm: number;
    nearestNeighborCountry: string;
    isInsideMarineProtectedArea: boolean;
    protectedAreaName?: string;
    riskStatus: string;
    notes: string;
  };
  safety: {
    compositeRiskScore: number;
    riskLevel: 'Minimal Risk' | 'Caution' | 'Hazardous' | 'Critical Danger';
    primaryRiskFactor: string;
    smallCraftAdvisory: boolean;
    factors: Array<{
      name: string;
      rawScore: number;
      weight: number;
      weightedScore: number;
      description: string;
    }>;
    actionableDirectives: string[];
  };
  sources: DataProvenance[];
}
```

---

## 5. Implementation Roadmap (Phases 2–18)

1. **Phase 2 — Domain Models & Service (`src/lib/domain/models.ts` & `src/lib/services/point-intelligence.service.ts`)**:
   - Define canonical `PointIntelligence` model.
   - Implement `PointIntelligenceService` orchestrating parallel provider fetches with graceful per-provider degradation.

2. **Phase 3 & 4 — Weather & Marine Extensions (`src/lib/providers/open-meteo.ts`)**:
   - Extend `OpenMeteoWeatherAdapter` to retrieve apparent temperature, relative humidity, and precipitation.
   - Extend `OpenMeteoMarineAdapter` to retrieve swell wave height, direction, and period.

3. **Phase 5 — Pure Live AIS Proximity (`src/lib/services/vessel.service.ts`)**:
   - Add `findNearbyLiveAisVessels(coord, radiusKm)` querying exclusively `this.aisAdapter.fetchLiveVessels()`.
   - Never inject baseline or simulated vessels into point intelligence. If count is 0, return status `NO_LIVE_DATA`.

4. **Phase 6 — Spatial Proximity (`src/lib/services/region.service.ts`)**:
   - Add `findNearestRegion(coord)` using Turf spherical distance against all 9 coastal sectors.

5. **Phase 7 — Safety Evaluation (`src/lib/services/safety.service.ts`)**:
   - Support direct safety assessment from already-fetched weather and marine metrics to avoid redundant external network roundtrips.

6. **Phase 8 — API Endpoint (`src/app/api/marine/point/route.ts`)**:
   - Implement `GET /api/marine/point?lat={lat}&lon={lon}` with input validation (`zod`), caching, and error handling.

7. **Phase 9 — Map Popup (`src/components/map/MarineMap.tsx`)**:
   - Add MapLibre Popup anchored to clicked coordinate.
   - Show loading state, then render:
     - Header: Coordinate (lat/lon) + Nearest Region
     - Weather grid: Temp, Feels Like, Humidity, Wind, Gusts
     - Marine grid: Waves, Swell, SST, Currents
     - Safety badge: Deterministic composite risk level
     - AIS telemetry: Live nearby vessels count or `NO_LIVE_DATA`
     - Action: **"ASK AUREXO"** button with tactical icon

8. **Phase 10 & 11 — "Ask Aurexo" & Conversational Context (`ChatDrawer.tsx` & `supervisor.ts`)**:
   - Add event / callback from map popup to `ChatDrawer` triggering inquiry with coordinate.
   - Update `supervisor.ts` to recognize queries targeting clicked point ("here", "this location", "conditions at this point") and ground answers in canonical point intelligence.
   - Retain coordinate in `sessionContext` for multi-turn conversational follow-ups.

9. **Phase 12 — Map Actions**:
   - Retain bi-directional map actions (`flyTo`, marker, highlighting).

10. **Phase 15 & 16 — Performance & Partial Degradation**:
    - Coordinate quantization (0.01° grid) for LRU caching.
    - If Open-Meteo succeeds but AIS has no data, return `weather: LIVE`, `marine: LIVE`, `vessels: NO_LIVE_DATA`.

11. **Phase 17 — Automated Tests (`src/tests/point-intelligence.test.ts`)**:
    - Validate coordinate extraction, API validation, normalization, partial failure handling, safety evaluation, and live AIS filtering.

12. **Phase 18 — Real-Data Verification (`AUREXO_POINT_INTELLIGENCE_REAL_DATA_AUDIT.md`)**:
    - Query real ocean coordinates (Mumbai Offshore, Goa, Kochi, Chennai, Bay of Bengal).
    - Document provider status, real values received, and zero-mock verification.

---

## 6. Architecture Review & Safety Check

- **Frontend Frozen Principle**: Dashboard layout, HUD, drawer, and navbar structures remain completely intact. The only change is rendering the native MapLibre popup on map click and triggering the drawer.
- **Single Source of Truth**: One canonical `PointIntelligenceService` feeds both the Map Popup and the Ask Aurexo Agent Swarm.
- **Zero Mock / Zero Fake Data**: Any missing or unreachable external signal defaults to honest `UNAVAILABLE` or `NO_LIVE_DATA`.
