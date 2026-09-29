# AUREXO // Marine Intelligence Platform
> **Smart India Hackathon 2026 — Problem Statement 176 / SIH26176**  
> *Autonomous Marine Ecosystem Reasoning with Collaborative Agents (ISRO)*

[![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-5.1-235882?style=flat-square&logo=maplibre)](https://maplibre.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash-8e75ff?style=flat-square&logo=google)](https://ai.google.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen_3.5_4B-white?style=flat-square&logo=ollama)](https://ollama.ai/)

---

## 🌊 Overview

**Aurexo** is a full-stack, map-first marine intelligence platform engineered for **SIH Problem Statement 176 (SIH26176)** sponsored by the **Indian Space Research Organisation (ISRO)**. 

Coastal communities, artisanal fishermen, and maritime operators face dangerous unpredictable weather, complex fragmented satellite portals (MOSDAC, INCOIS, Bhoonidhi), and an absence of real-time spatial reasoning. Aurexo unifies all of this into a single, light, **Pearl Marine Glass** surface that:
1. **Never hallucinates data**: Directly queries verified oceanographic feeds and satellite-derived layers before letting AI explain the evidence.
2. **Safeguards coastal operators**: Uses deterministic geospatial boundary reasoning (Turf.js) to compute proximity to the International Maritime Boundary Line (Pakistan and Sri Lanka IMBLs) and strict Marine Protected Areas (MPAs).
3. **Resilient AI fallback**: Employs a prioritized LLM chain (**Gemini 3.8 Flash** $\to$ **Ollama Qwen 3.5 4B** $\to$ **Ollama Llama 3.2 1B** $\to$ **Deterministic Rule Synthesizer**) with strict timeout protection.

---

## 🏗️ Architecture

Aurexo is built as **ONE unified full-stack Next.js monolith**. Zero secondary microservices, zero standalone backend daemons, zero unnecessary databases.

```
                           +------------------------------------------+
                           |            Browser Client Layer          |
                           |   - MapLibre GL Interactive Canvas       |
                           |   - Pearl Glass Telemetry HUD            |
                           |   - Conversational Tactical Copilot      |
                           +------------------------------------------+
                                    |                      |
           Direct Tile Stream       |                      | Internal API Routes
       (MODIS / GHRSST / Chl-A)     |                      | (/api/marine, /api/agent)
                                    v                      v
                       +----------------------+  +--------------------------------+
                       |   NASA GIBS WMTS/WMS |  |    Next.js Monolithic Server   |
                       |  (Client-Direct GIS) |  |   - Typed Tool Orchestrator    |
                       +----------------------+  |   - Deterministic Turf.js Geo  |
                                                 |   - LLM Provider Dispatcher    |
                                                 +--------------------------------+
                                                           |             |
                                  Verified Live REST Feeds |             | Prioritized AI Cascade
                                                           v             v
                                                 +-----------------+ +-------------------+
                                                 | Open-Meteo APIs | | Gemini 3.8 Flash  |
                                                 | (Marine & Wind) | | Ollama Qwen 3.5   |
                                                 +-----------------+ | Deterministic Rule|
                                                                     +-------------------+
```

---

## ✨ Key Features

- **Pearl Marine Glass Design System**: Minimalist, translucent white/pearl floating surfaces (`backdrop-blur-md`), subtle borders, soft shadows, and deep navy typography. No generic dark/neon cyber aesthetic or heavy 3D animations.
- **Client-Direct Satellite Layers**: MapLibre GL streams NASA Global Imagery Browse Services (GIBS) raster overlays directly from the browser:
  - **MODIS TrueColor Satellite Imagery**
  - **GHRSST Sea Surface Temperature (°C)** with dynamic color ramp
  - **MODIS Chlorophyll-A Concentration (mg/m³)**
- **Verified Live Telemetry**: Deterministic Open-Meteo integration for live wave height, swell period, currents, wind speed, Beaufort scale, and sea surface temperature with oceanic physical limits validation.
- **Deterministic Boundary Sentinel**: Evaluates distance to international maritime boundaries and point-in-polygon containment for ecological reserves (Gulf of Mannar, Gulf of Kutch, Sundarbans) to prevent accidental border crossings.
- **Navigational Passage Corridor Engine**: Calculates great-circle safe passage waypoints between coastal ports, computing distance, estimated travel duration, and checking intermediate boundary hazards.
- **Evidence & Source Verification**: Every agent message includes a collapsible disclosure panel displaying the exact data sources, observation timestamps, verification status (`VERIFIED_LIVE` / `DOCUMENTED_UNVERIFIED`), and LLM execution latency.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20+ or v24+
- **npm**: v10+ or v11+
- *(Optional for local AI)*: [Ollama](https://ollama.ai/) with `qwen3.5:4b` or `llama3.2:1b`

### Installation
```bash
# Clone the repository
git clone https://github.com/RUDRA795/aurexo1.git
cd aurexo1

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables (`.env.local`)
```env
# Primary LLM (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
GEMINI_TIMEOUT_MS=12000

# Local LLM Fallback (Ollama)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_PRIMARY_MODEL=qwen3.5:4b
OLLAMA_FALLBACK_MODEL=llama3.2:1b
OLLAMA_TIMEOUT_MS=15000
```

### Running Locally
```bash
# Start development server
npm run dev

# Open in browser:
# http://localhost:3000
```

---

## 🧪 Testing & Verification

Aurexo includes automated unit and integration tests with zero hardcoded measurement assumptions:

```bash
# Run test suite
npm test

# Run TypeScript compiler check
npx tsc --noEmit

# Run Next.js linter
npm run lint

# Build production bundle
npm run build
```

---

## 👥 Hackathon Team & Project Info

- **Hackathon**: Smart India Hackathon 2026
- **Problem Statement**: SIH26176 (PS 176)
- **Ministry / Sponsoring Agency**: Indian Space Research Organisation (ISRO) / Department of Space
- **Category**: Software (Disaster Management & Space Technology)
