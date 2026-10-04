'use client';

import React from 'react';
import Link from 'next/link';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Anchor,
  ChevronRight,
  Zap,
  Shield,
  Database,
} from 'lucide-react';

const PS_REQUIREMENTS = [
  { req: 'Real-time marine weather (wave, wind, SST)', status: 'live', coverage: 90, note: 'Open-Meteo Marine + Weather API — live, Zod-validated' },
  { req: 'Satellite oceanography (SST + Chlorophyll tiles)', status: 'live', coverage: 85, note: 'NASA GIBS WMS overlays — AQUA MODIS + VIIRS SNPP' },
  { req: 'EEZ & IMBL boundary geofencing', status: 'live', coverage: 80, note: 'Turf.js deterministic math over india_eez_imbl.geojson' },
  { req: 'Marine Protected Area compliance', status: 'live', coverage: 80, note: 'Point-in-polygon via Turf.js + marine_protected_areas.geojson' },
  { req: 'Conversational AI — Ask ORCA', status: 'live', coverage: 85, note: 'Multi-agent swarm, multi-turn memory, sessionContext' },
  { req: 'Geospatial map intelligence', status: 'live', coverage: 80, note: 'MapLibre GL — satellite layers, fleet layer, agent markers' },
  { req: 'Regional marine warning scanning', status: 'live', coverage: 70, note: '9 Indian sectors scanned against Open-Meteo live conditions' },
  { req: 'Safety & hazard engine', status: 'partial', coverage: 55, note: 'Open-Meteo derived; IMD/NAVTEX integration pending' },
  { req: 'Vessel tracking (AIS)', status: 'partial', coverage: 30, note: 'Domain AIS registry — no live AIS stream yet' },
  { req: 'PFZ / Fishing zone advisories', status: 'partial', coverage: 25, note: 'Static INCOIS reference sectors; live feed not integrated' },
  { req: 'Cyclone / storm alerts', status: 'missing', coverage: 5, note: 'IMD cyclone API not yet integrated' },
  { req: 'Emergency SOS / incident reporting', status: 'missing', coverage: 0, note: 'Feature not yet built' },
  { req: 'Blue economy analytics', status: 'partial', coverage: 20, note: 'PFZ reference only; CMFRI landing data reference' },
  { req: 'Route optimization / safe corridors', status: 'missing', coverage: 10, note: 'routes.ts stub exists; not wired to agent' },
  { req: 'Historical ocean trend analysis', status: 'missing', coverage: 0, note: 'Open-Meteo historical API available; not implemented' },
  { req: 'Offline / PWA support', status: 'missing', coverage: 0, note: 'No service worker yet' },
  { req: 'Multi-language (Hindi/Tamil)', status: 'missing', coverage: 0, note: 'English only' },
];

const TECH_STACK = [
  { label: 'Framework', value: 'Next.js 15 (App Router, TypeScript)' },
  { label: 'Map', value: 'MapLibre GL JS 5.x' },
  { label: 'AI Cascade', value: 'Gemini 3.8 Flash → Ollama qwen3.5:4b → llama3.2:1b → Rules' },
  { label: 'Marine Data', value: 'Open-Meteo Marine API (live, 5-min cache)' },
  { label: 'Satellite', value: 'NASA GIBS WMS (MODIS/VIIRS, daily)' },
  { label: 'Geospatial Math', value: '@turf/turf — point-in-polygon, line distance' },
  { label: 'Schema Validation', value: 'Zod (all external API responses validated)' },
  { label: 'Styling', value: 'Tailwind CSS 3.x + lucide-react icons' },
  { label: 'Charts', value: 'Recharts (analytics page)' },
  { label: 'Tests', value: 'Vitest — 20 passing (geo, tools, regions, vessels, supervisor)' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
      <CheckCircle className="h-3 w-3" /> LIVE
    </span>
  );
  if (status === 'partial') return (
    <span className="flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-mono text-yellow-400">
      <AlertTriangle className="h-3 w-3" /> PARTIAL
    </span>
  );
  return (
    <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-mono text-red-400">
      <XCircle className="h-3 w-3" /> PENDING
    </span>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] font-mono text-slate-400">{pct}%</span>
    </div>
  );
}

export default function AboutPage() {
  const liveCount = PS_REQUIREMENTS.filter((r) => r.status === 'live').length;
  const partialCount = PS_REQUIREMENTS.filter((r) => r.status === 'partial').length;
  const pendingCount = PS_REQUIREMENTS.filter((r) => r.status === 'missing').length;
  const overallPct = Math.round(PS_REQUIREMENTS.reduce((s, r) => s + r.coverage, 0) / PS_REQUIREMENTS.length);

  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24 text-slate-100">
      <div className="mx-auto max-w-screen-xl px-4">
        {/* Header */}
        <div className="mb-10">
          <div className="mb-2 flex items-center gap-2 text-xs font-mono text-slate-300">
            <Info className="h-3.5 w-3.5 text-slate-200" />
            SIH 2026 — PROBLEM STATEMENT PS-176
          </div>
          <h1 className="mb-3 font-mono text-3xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">About ORCA</h1>
          <p className="max-w-3xl text-slate-200 leading-relaxed drop-shadow">
            ORCA is built for <strong className="text-white">Smart India Hackathon 2026, Problem Statement PS-176</strong> —
            an AI-powered maritime intelligence platform for India&apos;s 7,500 km coastline, covering fisherman safety,
            vessel boundary compliance, marine resource sustainability and blue economy analytics.
          </p>
        </div>

        {/* Overall progress card */}
        <div className="mb-10 rounded-3xl border border-white/20 bg-white/[0.09] p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex flex-wrap items-center gap-8">
            <div className="text-center">
              <p className="font-mono text-5xl font-black text-white">{overallPct}%</p>
              <p className="mt-1 text-xs text-slate-300">Overall PS-176 Completion</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-emerald-300">{liveCount}</p>
                <p className="text-xs text-slate-300">Live</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-amber-300">{partialCount}</p>
                <p className="text-xs text-slate-300">Partial</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-rose-300">{pendingCount}</p>
                <p className="text-xs text-slate-300">Pending</p>
              </div>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        {/* Requirements table */}
        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-200" />
            <h2 className="font-mono text-xl font-bold text-white drop-shadow">PS-176 Requirement Coverage</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] shadow-xl backdrop-blur-md">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/60">
                  <th className="px-5 py-3 text-left text-xs font-mono text-slate-500">Requirement</th>
                  <th className="px-5 py-3 text-left text-xs font-mono text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-mono text-slate-500">Coverage</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-mono text-slate-500 md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {PS_REQUIREMENTS.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-slate-800/40 transition-colors hover:bg-slate-900/40 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}
                  >
                    <td className="px-5 py-3 text-sm text-slate-300">{r.req}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3"><CoverageBar pct={r.coverage} /></td>
                    <td className="hidden px-5 py-3 text-xs text-slate-500 md:table-cell">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tech stack */}
        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <Database className="h-5 w-5 text-slate-200" />
            <h2 className="font-mono text-xl font-bold text-white drop-shadow">Technology Stack</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TECH_STACK.map(({ label, value }) => (
              <div key={label} className="flex gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-4 shadow-sm backdrop-blur-md">
                <p className="w-28 flex-shrink-0 text-xs font-mono font-medium text-slate-300">{label}</p>
                <p className="text-sm font-medium text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture note */}
        <section className="mb-12 rounded-3xl border border-white/20 bg-white/[0.09] p-8 shadow-xl backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-300" />
            <h2 className="font-mono text-xl font-bold text-white drop-shadow">Architecture Principles</h2>
          </div>
          <ul className="space-y-3.5 text-sm text-slate-200">
            <li className="flex items-start gap-2.5"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" /> <span><strong className="text-white">No mock data.</strong> Every number shown to users comes from a verifiable external API (Open-Meteo, NASA GIBS) or clearly labelled as DOCUMENTED_UNVERIFIED reference data.</span></li>
            <li className="flex items-start gap-2.5"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" /> <span><strong className="text-white">Single monolith.</strong> One Next.js App Router application — no separate microservices or backends. All intelligence runs in Route Handlers server-side.</span></li>
            <li className="flex items-start gap-2.5"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" /> <span><strong className="text-white">LLM cascade.</strong> Gemini 3.8 Flash → Ollama (local, offline-capable) → deterministic rule fallback. Never fails even with no internet.</span></li>
            <li className="flex items-start gap-2.5"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" /> <span><strong className="text-white">Evidence model.</strong> Every agent response carries source timestamps, verification status and provenance — users always know what is live vs reference.</span></li>
            <li className="flex items-start gap-2.5"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" /> <span><strong className="text-white">Deterministic geospatial math.</strong> EEZ/IMBL/MPA calculations use Turf.js — no LLM hallucination in boundary checks.</span></li>
          </ul>
        </section>

        {/* CTA */}
        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 shadow-xl transition-all hover:bg-slate-100 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <Anchor className="h-5 w-5 text-slate-900" />
            Launch Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/RUDRA795/aurexo1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-6 py-3 font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
          >
            <ExternalLink className="h-5 w-5 text-slate-200" />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
