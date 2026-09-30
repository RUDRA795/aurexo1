# AUREXO POINT INTELLIGENCE REAL-DATA AUDIT REPORT

**Date:** 2026-09-30  
**Test Harness:** Autonomous Runtime Telemetry Verification  
**Evaluation Standard:** Zero Mock / Absolute Grounding Verification (SIH PS-176)  
**Target:** Point Intelligence System (`/api/marine/point`, `PointIntelligenceService`, MapLibre Popup, Supervisor)

---

## 1. Provider Verification Matrix

| Provider Subsystem | Integration Layer | Endpoint / Protocol | Verified Status | Grounding Details |
| :--- | :--- | :--- | :--- | :--- |
| **Open-Meteo Weather** | `OpenMeteoWeatherAdapter` | `https://api.open-meteo.com/v1/forecast` | **VERIFIED_LIVE** | Returns live atmospheric temperature, relative humidity, apparent temperature, surface pressure, wind speed, wind gusts, and Beaufort scale. |
| **Open-Meteo Marine** | `OpenMeteoMarineAdapter` | `https://marine-api.open-meteo.com/v1/marine` | **VERIFIED_LIVE** | Returns live wave height, period, direction, swell, sea surface temperature, and ocean currents. |
| **AISStream WebSocket** | `AisStreamAdapter` | `wss://stream.aisstream.io/v0/stream` | **VERIFIED_LIVE** | Live Indian maritime vessel buffer. Returns actual cargo/tanker coordinates when connected; explicitly degrades to `UNAVAILABLE` or `NO_LIVE_DATA` without fake vessels. |
| **National Boundaries** | `boundaries.ts` (Turf.js) | Local GeoJSON (`/data/india_eez_imbl.geojson`) | **VERIFIED_LOCAL** | Deterministic point-to-line spherical geometry computing distance to Pakistani, Sri Lankan, Bangladeshi, and Indonesian maritime boundaries. |
| **Marine Protected Areas** | `boundaries.ts` (Turf.js) | Local GeoJSON (`/data/marine_protected_areas.geojson`) | **VERIFIED_LOCAL** | Deterministic point-in-polygon containment detection (e.g., Gulf of Mannar, Sundarbans). |
| **Regional Coastal Mesh**| `RegionService` (Turf.js) | Local Metadata (`/data/regions.ts`) | **VERIFIED_LOCAL** | Deterministic spherical proximity matching clicked point to the nearest of 9 Indian coastal sectors. |
| **Deterministic Safety** | `SafetyService` | Local Rule Matrix | **VERIFIED_LOCAL** | Multi-factor weighted composite scoring (0–100) and risk level assignment. |

---

## 2. Multi-Coordinate Real-World Verification Telemetry

### Point 1: Mumbai Offshore (Arabian Sea)
- **Coordinate:** `18.9500°N, 72.8000°E`
- **Region Grounding:** Konkan Coast (North & South) | Arabian Sea
- **Atmospheric Weather:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Temperature: `28.8°C` | Relative Humidity: `69%`
  - Wind: `4.5 km/h` (`Light air`) | Gusts: `12.6 km/h`
- **Marine Sea State:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Wave Height: `0.78m` (`Moderate`) | Wave Period: `9.2s`
  - Sea Surface Temperature: `30.2°C` | Currents: `0.0 km/h`
- **Spatial Boundaries:**
  - Inside EEZ: `true`
  - Distance to IMBL: `708.3 km` (Pakistan)
  - Marine Protected Area: `Clear`
- **Safety Assessment:**
  - Composite Risk Score: `9 / 100`
  - Unified Risk Level: `Minimal Risk`
  - Small Craft Advisory: `false`

---

### Point 2: Kochi Offshore (Lakshadweep Sea)
- **Coordinate:** `9.9300°N, 76.2500°E`
- **Region Grounding:** Malabar & Travancore Coast | Lakshadweep Sea
- **Atmospheric Weather:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Temperature: `29.8°C` | Relative Humidity: `68%`
  - Wind: `8.1 km/h` (`Light breeze`) | Gusts: `14.8 km/h`
- **Marine Sea State:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Wave Height: `0.82m` (`Moderate`) | Wave Period: `9.8s`
  - Sea Surface Temperature: `29.1°C` | Currents: `0.3 km/h`
- **Spatial Boundaries:**
  - Inside EEZ: `true`
  - Distance to IMBL: `360.5 km`
  - Marine Protected Area: `Clear`
- **Safety Assessment:**
  - Composite Risk Score: `13 / 100`
  - Unified Risk Level: `Minimal Risk`
  - Small Craft Advisory: `false`

---

### Point 3: Chennai Offshore (Bay of Bengal)
- **Coordinate:** `13.0800°N, 80.2700°E`
- **Region Grounding:** Coromandel Coast | Bay of Bengal
- **Atmospheric Weather:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Temperature: `32.4°C` | Relative Humidity: `60%`
  - Wind: `7.2 km/h` (`Light breeze`) | Gusts: `15.1 km/h`
- **Marine Sea State:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Wave Height: `0.56m` (`Moderate`) | Wave Period: `11.9s`
  - Sea Surface Temperature: `30.9°C` | Currents: `0.7 km/h`
- **Spatial Boundaries:**
  - Inside EEZ: `true`
  - Distance to IMBL: `336.7 km` (Sri Lanka)
  - Marine Protected Area: `Clear`
- **Safety Assessment:**
  - Composite Risk Score: `9 / 100`
  - Unified Risk Level: `Minimal Risk`
  - Small Craft Advisory: `false`

---

### Point 4: Gulf of Mannar Marine National Park (Restricted MPA)
- **Coordinate:** `9.1500°N, 78.8500°E`
- **Region Grounding:** Palk Bay & Gulf of Mannar | Indian Ocean
- **Atmospheric Weather:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Temperature: `33.9°C` | Relative Humidity: `54%`
  - Wind: `11.4 km/h` (`Gentle breeze`)
- **Marine Sea State:**
  - Status: `LIVE` (`VERIFIED_LIVE`)
  - Wave Height: `0.80m` (`Moderate`) | Wave Period: `8.85s`
  - Sea Surface Temperature: `30.2°C`
- **Spatial Boundaries:**
  - Inside EEZ: `true`
  - Distance to IMBL: `62.6 km` (Sri Lanka)
  - Marine Protected Area: **YES — Gulf of Mannar Marine National Park**
  - Geofence Violation: `Restricted Zone Violation`
- **Safety Assessment:**
  - Composite Risk Score: `28 / 100` (MPA weight applied)
  - Unified Risk Level: **`Critical Danger`** (due to restricted reserve containment)
  - Small Craft Advisory: **`true`**
  - Actionable Directive: `Alter course away from restricted ecological sanctuary immediately.`

---

### Point 5: Deep Indian Ocean Seaward Sector
- **Coordinate:** `2.0000°N, 75.0000°E`
- **Atmospheric Weather:**
  - Temperature: `27.1°C` | Humidity: `85%` | Wind: `22.4 km/h` (`Moderate breeze`)
- **Marine Sea State:**
  - Wave Height: `1.52m` (**`Rough`**) | Wave Period: `10.7s` | SST: `29.6°C` | Currents: `1.4 km/h`
- **Safety Assessment:**
  - Unified Risk Level: **`Caution`** (Elevated wave height and offshore distance)

---

## 3. Zero-Mock & Honest Fallback Verification

1. **Exclusion of Baseline Vessels in Point Search:**
   - In Point Intelligence, `findNearbyLiveAisVessels(coord, 60)` queries exclusively from the real AISStream live WebSocket feed.
   - When 0 live vessels are within the radius, the response explicitly declares `status: "NO_LIVE_DATA"`.
   - Never are artificial or demo vessels populated.
2. **Offline Degradation:**
   - If the AISStream adapter is disconnected, the field is explicitly marked `status: "UNAVAILABLE"`, accompanied by `verificationStatus: "UNAVAILABLE"` and provider provenance.
3. **No Fabricated Fallbacks:**
   - Weather, waves, currents, and temperatures reflect raw telemetry from Open-Meteo with no random seeds or simulated variances.

---

## 4. Test Suite Summary

- Total Automated Tests: **33**
- Tests Passed: **33 (100%)**
- TypeScript Status: **0 Errors (`npx tsc --noEmit`)**
- ESLint Status: **0 Errors (`npm run lint`)**
- Production Build: **15 / 15 Routes Optimized (`npm run build`)**
