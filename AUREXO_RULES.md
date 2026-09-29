# AUREXO Engineering Rules & Architecture Mandates

## 1. Clean-Slate Mandate
- Aurexo is an independent, clean-slate project for SIH Problem Statement 176 / SIH26176.
- Never reuse, copy, import, inspect, or depend on any previous ORCA project architecture, files, code, agents, database schemas, APIs, folder structures, design decisions, roadmap items, tests, or implementation patterns.

## 2. Monolithic Architecture & Single Runtime
- Aurexo is **ONE integrated full-stack application** built with **Next.js (App Router) + TypeScript + Tailwind CSS**.
- Frontend, server logic, agent orchestration, marine-data tools, geospatial reasoning, and API routes live in one coherent codebase.
- Runs with one command: `npm run dev`.
- **Zero microservices**, zero separately running background servers, zero unneeded databases (no Redis, no Kubernetes, no standalone backend services).
- **Client/Server Boundary**: All business logic, tool execution, and external API requests MUST stay in the server/domain layer (`src/lib/...`, `src/app/api/...`). React components must NEVER directly invoke external marine APIs.

## 3. UI Design System (Pearl Marine Glass)
- **Aesthetic**: Premium, light, restrained pearl/glassmorphism.
- **Color Palette**: Translucent white/pearl surfaces (`rgba(255, 255, 255, 0.85)` / `backdrop-blur-md`), subtle borders (`border-slate-200/60`), soft shadows, deep navy text (`text-slate-900`, `text-slate-700`), crisp ocean accents (cerulean, marine cyan, seafoam).
- **Anti-Patterns**: STRICTLY FORBIDDEN: Generic black/neon-cyan cyber dashboards, glowing borders, 3D ocean canvases, Three.js water meshes, excessive animations, and decorative clutter.
- **Primary Surface**: The map IS the main UI canvas (MapLibre GL JS with satellite and oceanographic raster/vector layers). UI controls float neatly as minimalist frosted-glass HUD panels.
- **NASA GIBS Architecture**: Browser-side MapLibre GL connects directly to NASA GIBS WMS/WMTS endpoints for satellite-derived layers. Do not proxy satellite tiles through the Next.js server unless strictly necessary.

## 4. AI & Multi-Tool Orchestration Protocol
- **Primary LLM**: `gemini-3.8-flash` via the official Google GenAI integration (`GEMINI_MODEL=gemini-3.8-flash`). Do not implement Gemini 1.5 Flash. Support higher-reasoning models (e.g. `gemini-3.8-pro` / `gemini-3.7-pro`) only as an explicit escalation path.
- **Ollama Local Fallback**: Priority sequence:
  1. `gemini-3.8-flash` (Primary remote)
  2. `qwen3.5:4b` (Primary local reasoning on `http://127.0.0.1:11434`)
  3. `llama3.2:1b` (Secondary local fallback)
  4. Deterministic rule-based synthesizer fallback (Zero-hallucination structured synthesis).
- **Typed Tools First**: All marine capabilities (SST, Chlorophyll, Waves, Wind, Currents, PFZ, Warnings, Boundaries, Geofences, Routes) are implemented as typed tools with explicit inputs/outputs.
- **Zero Hallucination Mandate**: The LLM must **NEVER** invent marine measurements, temperatures, wave heights, or coordinates.
- **Execution Flow**:
  1. User natural language prompt arrives.
  2. Orchestrator parses intent and calls deterministic typed tools.
  3. Real data is retrieved from authoritative APIs and validated with Zod.
  4. Geospatial analysis (distances, boundary intersections, risk levels) is computed deterministically with Turf.js.
  5. The LLM receives the verified domain payload and generates an explainable, contextual synthesis with explicit source citations.

## 5. Geospatial & Data Integrity Principles
- **Data Source Categorization**:
  - **VERIFIED LIVE**: Open-Meteo Marine API, Open-Meteo Weather API, NASA GIBS WMS/WMTS (MODIS TrueColor, GHRSST SST, MODIS Chl-A), Local Ollama (`qwen3.5:4b`, `llama3.2:1b`).
  - **DOCUMENTED BUT NOT YET VERIFIED**: INCOIS PFZ advisory feeds, IMD Marine Weather Bulletins, official Maritime boundary GeoJSON datasets.
  - **PLANNED / FUTURE**: ISRO MOSDAC OPeNDAP/FTP pipelines, ISRO Bhoonidhi STAC, AIS/VMS real-time vessel tracking.
- **No Fabricated Live Values**: Never hardcode or assume expected marine measurements (e.g. "0.9m" or "30.4°C") in demo logic or test assertions. Tests must validate response schema, numeric validity, physical ranges (e.g., wave height $0 \le h \le 30\text{m}$, SST $-2 \le T \le 45^\circ\text{C}$), timestamps, and source metadata.
- **Satellite Terminology**: Accurately describe satellite data as "satellite imagery", "satellite observation", "satellite-derived layer", and "retrieved observation time", rather than instantaneous live telemetry.
- **Unverified Source Handling**: If an unverified source (e.g. INCOIS/IMD) is unavailable or unverified during the 7-hour window, the system must expose a clear `UNAVAILABLE` state. Never fabricate fake values.
- **Deterministic Math**: Calculations (geofencing, distances, route points, danger zones) are computed strictly in TypeScript using `@turf/turf`. No LLM math.

## 6. Security & Code Quality Rules
- **Security**: Never write API keys into source code. Always use environment variables (`.env.local`). Server-only keys (`GEMINI_API_KEY`, `DHAMMU_GEMINI_API_KEY`) must NEVER be exposed to client components (never use `NEXT_PUBLIC_` for secret keys).
- **No Dead Code**: Every production file must have an active consumer.
- **No Artifact Trash**: Zero files named `*-v2`, `*copy`, `*old`, `*backup`, `*test2`, or dummy placeholders.
- **Domain Normalization**: Keep external API formats out of React components. Normalize all external payloads into strict Aurexo domain types.
- **Strict Typing**: TypeScript `strict: true`. No `any` escapes in core domain logic.
