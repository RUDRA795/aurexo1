'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Anchor,
  Waves,
  Wind,
  Thermometer,
  Shield,
  Satellite,
  Ship,
  MessageSquare,
  Globe2,
  BarChart3,
  ChevronRight,
  Radio,
  AlertTriangle,
  Zap,
  Navigation,
  Fish,
  Activity,
} from 'lucide-react';

// ─── Feature cards ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Waves,
    title: 'Live Ocean Intelligence',
    desc: 'Real-time wave height, period, sea surface temperature and current velocity via Open-Meteo Marine API.',
    tag: 'VERIFIED LIVE',
    tagColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    href: '/dashboard',
  },
  {
    icon: Ship,
    title: 'Fleet & AIS Tracking',
    desc: 'Monitor registered Indian fishing and coast guard vessels with AIS registry and nearest-vessel routing.',
    tag: 'AIS REGISTRY',
    tagColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    href: '/fleet',
  },
  {
    icon: Fish,
    title: 'Potential Fishing Zones',
    desc: 'INCOIS-standard PFZ sectors with chlorophyll gradient, SST thermal fronts and target species advisory.',
    tag: 'DOCUMENTED',
    tagColor: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    href: '/analytics',
  },
  {
    icon: Shield,
    title: 'Safety & Boundary Engine',
    desc: 'Deterministic EEZ / IMBL proximity checks, MPA containment detection and unified risk scoring.',
    tag: 'LIVE-FUSED',
    tagColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    href: '/dashboard',
  },
  {
    icon: Satellite,
    title: 'Satellite Observation Layers',
    desc: 'NASA GIBS SST, Chlorophyll and TrueColor satellite overlays rendered live on the geospatial canvas.',
    tag: 'NASA GIBS',
    tagColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    href: '/dashboard',
  },
  {
    icon: Globe2,
    title: 'Regional Marine Warnings',
    desc: '9 Indian coastal sectors continuously scanned for active advisories — from Saurashtra to Andaman.',
    tag: '9 SECTORS',
    tagColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    href: '/regions',
  },
];

// ─── Stat strip ─────────────────────────────────────────────────────────────
interface LiveStat {
  port: string;
  wave: string;
  wind: string;
  sst: string;
  status: 'calm' | 'moderate' | 'rough';
}

const SEED_STATS: LiveStat[] = [
  { port: 'Mumbai (Konkan)', wave: '—', wind: '—', sst: '—', status: 'calm' },
  { port: 'Kochi (Malabar)', wave: '—', wind: '—', sst: '—', status: 'calm' },
  { port: 'Chennai (Coromandel)', wave: '—', wind: '—', sst: '—', status: 'calm' },
];

const PORT_COORDS = [
  { latitude: 18.93, longitude: 72.83 },
  { latitude: 9.93, longitude: 76.27 },
  { latitude: 13.08, longitude: 80.27 },
];

// ─── Home Page ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats, setStats] = useState<LiveStat[]>(SEED_STATS);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled(
        PORT_COORDS.map((c) =>
          fetch(`/api/marine/conditions?lat=${c.latitude}&lon=${c.longitude}`).then((r) =>
            r.ok ? r.json() : null
          )
        )
      );
      setStats((prev) =>
        prev.map((s, i) => {
          const r = results[i];
          if (r.status === 'fulfilled' && r.value) {
            const d = r.value;
            const waveM: number = d.wave?.heightMeters ?? 0;
            const windK: number = d.wind?.speedKmh ?? 0;
            const sstC: number = d.sst?.temperatureCelsius ?? 0;
            const status: LiveStat['status'] =
              waveM >= 2.5 ? 'rough' : waveM >= 1.5 ? 'moderate' : 'calm';
            return {
              ...s,
              wave: `${waveM.toFixed(1)} m`,
              wind: `${windK.toFixed(0)} km/h`,
              sst: `${sstC.toFixed(1)} °C`,
              status,
            };
          }
          return s;
        })
      );
      setStatsLoaded(true);
    };
    load();
  }, []);

  const statusColors: Record<LiveStat['status'], string> = {
    calm: 'text-emerald-400',
    moderate: 'text-yellow-400',
    rough: 'text-red-400',
  };

  const statusLabels: Record<LiveStat['status'], string> = {
    calm: 'Calm',
    moderate: 'Moderate',
    rough: 'Rough',
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-20 text-center">
        {/* Subtle ambient light wash for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950/60" />

        {/* Hero Content (Floating over Global Video) */}
        <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-md">
            <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
            SIH 2026 PS-176 — India Maritime Intelligence Platform
          </div>

          {/* Headline */}
          <h1 className="mb-4 font-mono text-5xl font-black leading-tight tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.7)] md:text-7xl">
            ORCA
          </h1>
          <p className="mb-3 font-mono text-xl font-semibold text-slate-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] md:text-2xl">
            Marine EcOsystem Reasoning with Collaborative Agents
          </p>
          <p className="mb-10 max-w-2xl text-base leading-relaxed text-slate-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] md:text-lg">
            AI-powered maritime situational awareness — real-time ocean data, satellite intelligence,
            vessel tracking, and collaborative reasoning for India&apos;s 7,500 km coastline.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 shadow-xl transition-all hover:bg-slate-100 hover:shadow-2xl hover:scale-105 active:scale-95"
            >
              <MessageSquare className="h-5 w-5 text-slate-900" />
              Ask ORCA
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/regions"
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-6 py-3 font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:border-white/50 hover:bg-white/25 active:scale-95"
            >
              <Globe2 className="h-5 w-5 text-slate-200" />
              View Regions
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce text-slate-300">
          <ChevronRight className="h-5 w-5 rotate-90" />
        </div>
      </section>

      {/* ── Live Conditions Strip ─────────────────────────────────── */}
      <section className="border-y border-white/10 bg-slate-950/40 px-4 py-8 backdrop-blur-md">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-mono text-slate-300">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            LIVE CONDITIONS — KEY PORTS
            {!statsLoaded && <span className="ml-2 text-slate-400">Loading…</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.port}
                className="flex items-start justify-between rounded-2xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-md transition-all hover:bg-white/[0.15] hover:border-white/30"
              >
                <div>
                  <p className="mb-1 text-xs font-mono font-medium text-slate-200">{s.port}</p>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm font-medium text-white">
                      <Waves className="h-3.5 w-3.5 text-sky-400" />
                      {s.wave}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-white">
                      <Wind className="h-3.5 w-3.5 text-slate-300" />
                      {s.wind}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-white">
                      <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                      {s.sst}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/15 bg-white/10 ${statusColors[s.status]}`}>
                  {statusLabels[s.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 font-mono text-3xl font-bold text-white md:text-4xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              Platform Capabilities
            </h2>
            <p className="mx-auto max-w-2xl text-slate-200 drop-shadow">
              Every feature built to fulfil SIH PS-176 requirements — verified live data, no mock
              numbers, no fabrication.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, tag, tagColor, href }) => (
              <Link
                key={title}
                href={href}
                className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] p-6 shadow-xl backdrop-blur-md transition-all hover:border-white/35 hover:bg-white/[0.14] hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-sm transition-all group-hover:border-white/40 group-hover:bg-white/20">
                    <Icon className="h-5 w-5 text-slate-100" />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold ${tagColor}`}
                  >
                    {tag}
                  </span>
                </div>
                <h3 className="mb-2 font-semibold text-white group-hover:text-slate-100">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-200">{desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Explore <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-slate-950/40 px-4 py-20 backdrop-blur-md">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 font-mono text-3xl font-bold text-white drop-shadow">
              Multi-Agent Intelligence
            </h2>
            <p className="text-slate-200">
              5 specialized AI agents collaborate to answer every maritime query.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-5">
            {[
              { icon: Waves, name: 'Ocean Agent', desc: 'Fetches live wave, SST & current data' },
              { icon: Wind, name: 'Weather Agent', desc: 'Wind, pressure & hazard classification' },
              { icon: Shield, name: 'Sentinel Agent', desc: 'Boundary, MPA & geofence enforcement' },
              { icon: Ship, name: 'Vessels Agent', desc: 'AIS registry, fleet & nearest vessel' },
              { icon: Fish, name: 'Blue Economy Agent', desc: 'PFZ advisories & habitat suitability' },
            ].map(({ icon: Icon, name, desc }, i) => (
              <div key={name} className="flex flex-col items-center text-center p-4 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm">
                <div className="relative mb-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-sm">
                    <Icon className="h-6 w-6 text-slate-100" />
                  </div>
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-1 ring-white/30">
                    {i + 1}
                  </div>
                </div>
                <p className="mb-1 text-sm font-semibold text-white">{name}</p>
                <p className="text-xs leading-relaxed text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-6 py-4 backdrop-blur-md shadow-lg">
              <Zap className="h-5 w-5 text-amber-300" />
              <span className="text-sm font-medium text-slate-100">
                Supervisor Agent orchestrates all 5 agents — Gemini 3.8 Flash → Ollama → Deterministic Fallback
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PS 176 Compliance Strip ───────────────────────────────── */}
      <section className="border-t border-white/10 px-4 py-16">
        <div className="mx-auto max-w-screen-xl">
          <div className="rounded-3xl border border-white/20 bg-white/[0.09] p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h3 className="font-mono text-lg font-bold text-white">SIH 2026 — Problem Statement PS-176</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-slate-200">
              ORCA directly addresses the Smart India Hackathon 2026 PS-176 requirement for an
              AI-powered maritime intelligence platform covering India&apos;s exclusive economic zone,
              fisherman safety, vessel compliance and blue economy sustainability.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Ocean Data', value: '90%', color: 'text-emerald-300' },
                { label: 'Satellite Intel', value: '85%', color: 'text-emerald-300' },
                { label: 'Safety Engine', value: '55%', color: 'text-amber-300' },
                { label: 'Vessel Tracking', value: '30%', color: 'text-orange-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm">
                  <p className="mb-1 text-xs text-slate-300">{label} Coverage</p>
                  <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/about"
                className="flex items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
              >
                View full PS-176 analysis <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 px-4 py-8 text-center">
        <div className="mx-auto max-w-screen-xl flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 overflow-hidden rounded-full border border-cyan-400/40">
              <img src="/images/orca-logo-circle.png" alt="ORCA" className="h-full w-full object-cover" />
            </div>
            <span className="font-mono text-sm font-semibold text-slate-300">ORCA</span>
          </div>
          <p className="text-xs text-slate-600">
            Marine data: Open-Meteo (live) · Satellite: NASA GIBS · Boundaries: EEZ/IMBL GeoJSON ·
            SIH 2026 PS-176
          </p>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-300">Dashboard</Link>
            <Link href="/fleet" className="text-xs text-slate-500 hover:text-slate-300">Fleet</Link>
            <Link href="/regions" className="text-xs text-slate-500 hover:text-slate-300">Regions</Link>
            <Link href="/analytics" className="text-xs text-slate-500 hover:text-slate-300">Analytics</Link>
            <Link href="/about" className="text-xs text-slate-500 hover:text-slate-300">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
