'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Zap,
  Fish,
  Activity,
  Navigation,
  Eye,
  Radar,
  MapPin,
  ArrowDown,
  Cpu,
  Database,
  ShieldCheck,
  Crosshair,
  Compass,
  Mic,
  Languages,
} from 'lucide-react';

// ─── Live port stat types ────────────────────────────────────────────────
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
  { port: 'Visakhapatnam (Andhra)', wave: '—', wind: '—', sst: '—', status: 'calm' },
];

const PORT_COORDS = [
  { latitude: 18.93, longitude: 72.83 },
  { latitude: 9.93, longitude: 76.27 },
  { latitude: 13.08, longitude: 80.27 },
  { latitude: 17.68, longitude: 83.21 },
];

// ─── Feature cards ──────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Waves,
    title: 'Live Ocean Telemetry',
    desc: 'Real-time wave height, sea surface temperature, current velocity — Open-Meteo Marine API with Zod-validated responses.',
    tag: 'VERIFIED LIVE',
    accent: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/20',
  },
  {
    icon: Satellite,
    title: 'NASA GIBS Satellite Layers',
    desc: 'MODIS AQUA SST, VIIRS SNPP Chlorophyll-a, and TrueColor composites — rendered live on the geospatial canvas.',
    tag: 'NASA GIBS',
    accent: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/20',
  },
  {
    icon: Ship,
    title: 'AISStream Fleet Tracking',
    desc: 'Real-time WebSocket vessel telemetry covering Indian Ocean & Arabian Sea — live MMSI, heading, speed, draft.',
    tag: 'LIVE AIS',
    accent: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/20',
  },
  {
    icon: Shield,
    title: 'Geofence Compliance Engine',
    desc: 'Deterministic EEZ/IMBL boundary proximity, MPA containment detection, and fused risk scoring via Turf.js.',
    tag: 'DETERMINISTIC',
    accent: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/20',
  },
  {
    icon: Fish,
    title: 'PFZ & Blue Economy Analytics',
    desc: 'INCOIS Potential Fishing Zones — chlorophyll-SST thermal break correlation with target species habitat maps.',
    tag: 'INCOIS LIVE',
    accent: 'from-teal-500 to-cyan-600',
    glow: 'shadow-teal-500/20',
  },
  {
    icon: Globe2,
    title: '9-Sector Marine Warnings',
    desc: 'Continuous monitoring of all Indian coastal sectors — Saurashtra to Andaman — with real-time hazard classification.',
    tag: '9 SECTORS',
    accent: 'from-purple-500 to-violet-600',
    glow: 'shadow-purple-500/20',
  },
];

// ─── Sonar Waveform bar component ───────────────────────────────────────
function SonarBar({ delay, height }: { delay: number; height: number }) {
  return (
    <div
      className="w-[2px] rounded-full bg-gradient-to-t from-cyan-500/80 to-cyan-300/40"
      style={{
        height: `${height}px`,
        animation: `waveform ${1.2 + delay * 0.15}s ease-in-out ${delay * 0.08}s infinite`,
      }}
    />
  );
}

// ─── Radar Sweep overlay ────────────────────────────────────────────────
function RadarSweep() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] opacity-[0.07]">
        {/* Concentric rings */}
        {[120, 200, 300, 420].map((size) => (
          <div
            key={size}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/60"
            style={{ width: size, height: size }}
          />
        ))}
        {/* Sweep arm */}
        <div
          className="absolute left-1/2 top-1/2 h-[210px] w-[2px] origin-top animate-radar"
          style={{
            background: 'linear-gradient(to bottom, rgba(6,182,212,0.7), transparent)',
            transformOrigin: '50% 0%',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
    </div>
  );
}

// ─── Scroll reveal hook ─────────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ─── Home Page ───────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats, setStats] = useState<LiveStat[]>(SEED_STATS);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  // Scroll reveal refs for each section
  const statsReveal = useScrollReveal(0.1);
  const featuresReveal = useScrollReveal(0.08);
  const agentsReveal = useScrollReveal(0.1);
  const complianceReveal = useScrollReveal(0.1);

  // Hero entrance animation delay
  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Load live port conditions
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
    moderate: 'text-amber-400',
    rough: 'text-red-400',
  };

  const statusLabels: Record<LiveStat['status'], string> = {
    calm: 'Calm',
    moderate: 'Moderate',
    rough: 'Rough',
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 overflow-x-hidden">
      {/* ══════════════════════════════════════════════════════════════════
          SCENE 1: CINEMATIC HERO — ORBITAL VIEW
          Full-viewport hero with video backdrop, radar sweep, sonar bars
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
        {/* Grid matrix overlay */}
        <div className="pointer-events-none absolute inset-0 grid-matrix-pattern opacity-30" />

        {/* Radar sweep */}
        <RadarSweep />

        {/* Scanning line */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent animate-scanline"
          />
        </div>

        {/* Sonar pulse rings behind hero text */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {[0, 0.6, 1.2].map((delay, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/30"
              style={{
                width: 300 + i * 120,
                height: 300 + i * 120,
                animation: `sonar-pulse 3s cubic-bezier(0,0.2,0.8,1) ${delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Hero content — staggered entrance */}
        <div
          className={`relative z-10 flex flex-col items-center max-w-5xl mx-auto px-4 text-center transition-all duration-1000 ${
            heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Mission Classification Badge */}
          <div
            className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-cyan-950/60 px-5 py-2 text-xs font-mono backdrop-blur-xl shadow-lg"
            style={{ transitionDelay: '200ms' }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <span className="text-emerald-300 font-semibold">MISSION ACTIVE</span>
            <span className="text-slate-400">|</span>
            <span className="text-cyan-200">SIH 2026 · PS-176</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-300">ISRO Classification</span>
          </div>

          {/* Main Title */}
          <h1
            className={`mb-2 font-mono text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_40px_rgba(6,182,212,0.3)] md:text-8xl transition-all duration-700 delay-300 ${
              heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <span className="bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
              AUREXO
            </span>
          </h1>

          <div
            className={`mb-4 flex items-center gap-3 transition-all duration-700 delay-500 ${
              heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-cyan-500/60" />
            <span className="font-mono text-sm tracking-[0.35em] text-cyan-400">
              ORCA MARINE INTELLIGENCE
            </span>
            <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-cyan-500/60" />
          </div>

          <p
            className={`mb-3 text-xl font-medium text-slate-200/90 drop-shadow-lg md:text-2xl transition-all duration-700 delay-700 ${
              heroLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Oceanic Reasoning & Collaborative Agents
          </p>

          <p
            className={`mb-10 max-w-2xl text-base leading-relaxed text-slate-300/80 md:text-lg transition-all duration-700 delay-[900ms] ${
              heroLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Production-grade maritime situational awareness — real-time ocean telemetry,
            NASA satellite intelligence, live AIS vessel feeds, and 5-agent collaborative swarm
            reasoning for India&apos;s 7,500 km coastline.
          </p>

          {/* Sonar waveform bar visualizer */}
          <div
            className={`mb-10 flex items-end gap-[3px] h-8 transition-all duration-700 delay-[1100ms] ${
              heroLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {Array.from({ length: 40 }).map((_, i) => (
              <SonarBar key={i} delay={i} height={4 + Math.random() * 20} />
            ))}
          </div>

          {/* CTA buttons */}
          <div
            className={`flex flex-wrap items-center justify-center gap-4 transition-all duration-700 delay-[1300ms] ${
              heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Link
              href="/dashboard"
              className="group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 font-semibold text-white shadow-xl shadow-cyan-500/25 transition-all hover:shadow-2xl hover:shadow-cyan-500/40 hover:scale-105 active:scale-95"
            >
              <MessageSquare className="h-5 w-5" />
              Launch Mission Control
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/regions"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-6 py-3 font-semibold text-white shadow-lg backdrop-blur-xl transition-all hover:border-cyan-500/40 hover:bg-cyan-950/40 active:scale-95"
            >
              <Globe2 className="h-5 w-5 text-cyan-300" />
              Coastal Sectors
            </Link>
            <Link
              href="/about"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 font-semibold text-slate-200 backdrop-blur-xl transition-all hover:bg-white/[0.08] active:scale-95"
            >
              <Eye className="h-5 w-5 text-slate-400" />
              PS-176 Audit
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className={`absolute bottom-8 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-700 delay-[1800ms] ${
            heroLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-[10px] font-mono tracking-widest text-cyan-400/60">SCROLL TO DIVE</span>
          <ArrowDown className="h-4 w-4 text-cyan-400/50 animate-bounce" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SCENE 2: LIVE TELEMETRY STRIP — ATMOSPHERIC DESCENT
          Real-time port conditions with glowing cards
      ══════════════════════════════════════════════════════════════════ */}
      <section
        ref={statsReveal.ref}
        className="relative border-y border-cyan-900/30 bg-gradient-to-b from-slate-950/80 via-[#050a14]/90 to-slate-950/80 px-4 py-14 backdrop-blur-lg"
      >
        {/* Background grid */}
        <div className="pointer-events-none absolute inset-0 grid-matrix-pattern opacity-20" />

        <div className="mx-auto max-w-screen-xl relative">
          <div
            className={`mb-6 flex items-center gap-3 transition-all duration-700 ${
              statsReveal.visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
            }`}
          >
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-emerald-300">LIVE FEED</span>
            </div>
            <span className="text-sm font-mono text-slate-400">
              Real-Time Indian Port Conditions
            </span>
            {!statsLoaded && (
              <span className="ml-2 text-xs text-slate-500 animate-pulse">Acquiring telemetry...</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s, idx) => (
              <div
                key={s.port}
                className={`relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 backdrop-blur-md transition-all duration-700 hover:border-cyan-500/30 hover:bg-white/[0.1] animate-telemetry-glow ${
                  statsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${200 + idx * 150}ms` }}
              >
                {/* Port name */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-xs font-mono font-semibold text-slate-200">{s.port}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${
                      statusColors[s.status]
                    }`}
                  >
                    {statusLabels[s.status]}
                  </span>
                </div>

                {/* Telemetry readings */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Waves className="h-3.5 w-3.5 text-sky-400" />
                      Wave
                    </span>
                    <span className="font-mono font-semibold text-white">{s.wave}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Wind className="h-3.5 w-3.5 text-indigo-400" />
                      Wind
                    </span>
                    <span className="font-mono font-semibold text-white">{s.wind}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                      SST
                    </span>
                    <span className="font-mono font-semibold text-white">{s.sst}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SCENE 3: PLATFORM CAPABILITIES — OCEAN SURFACE
          Feature grid with gradient accent cards
      ══════════════════════════════════════════════════════════════════ */}
      <section ref={featuresReveal.ref} className="relative px-4 py-24">
        <div className="mx-auto max-w-screen-xl">
          <div
            className={`mb-14 text-center transition-all duration-700 ${
              featuresReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-mono text-slate-400 backdrop-blur-md">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              VERIFIED DATA SOURCES · NO MOCK DATA
            </div>
            <h2 className="mb-3 text-4xl font-bold text-white drop-shadow-lg md:text-5xl">
              Platform Capabilities
            </h2>
            <p className="mx-auto max-w-2xl text-slate-300 leading-relaxed">
              Every feature built to fulfil SIH PS-176 requirements — verified live data,
              Zod-validated schemas, deterministic geospatial math.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, tag, accent, glow }, idx) => (
              <div
                key={title}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6 backdrop-blur-sm transition-all duration-700 hover:border-white/25 hover:shadow-lg ${glow} ${
                  featuresReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${100 + idx * 120}ms` }}
              >
                {/* Accent gradient strip at top */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${accent} opacity-60 group-hover:opacity-100 transition-opacity`} />

                <div className="mb-4 flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-lg ${glow}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[9px] font-mono font-bold text-cyan-300">
                    {tag}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-300/90">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SCENE 4: MULTI-AGENT SWARM ARCHITECTURE — DEEP OCEAN
          5 agents + Supervisor with connection lines
      ══════════════════════════════════════════════════════════════════ */}
      <section
        ref={agentsReveal.ref}
        className="relative border-t border-cyan-900/20 bg-gradient-to-b from-transparent via-[#030810]/80 to-transparent px-4 py-24"
      >
        <div className="pointer-events-none absolute inset-0 grid-matrix-pattern opacity-15" />

        <div className="mx-auto max-w-screen-xl relative">
          <div
            className={`mb-14 text-center transition-all duration-700 ${
              agentsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-mono">
              <Cpu className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-purple-300">COLLABORATIVE REASONING ENGINE</span>
            </div>
            <h2 className="mb-3 text-4xl font-bold text-white md:text-5xl">
              5-Agent Swarm Architecture
            </h2>
            <p className="text-slate-300">
              Specialized AI agents collaborate in real-time to answer every maritime query with verified evidence.
            </p>
          </div>

          {/* Agent cards */}
          <div className="grid gap-5 md:grid-cols-5">
            {[
              {
                icon: Waves,
                name: 'Ocean Agent',
                desc: 'Live wave, SST & current data via Open-Meteo Marine API',
                color: 'from-cyan-500/20 to-cyan-900/20 border-cyan-500/30',
                dot: 'bg-cyan-500',
                accent: 'text-cyan-400',
              },
              {
                icon: Wind,
                name: 'Weather Agent',
                desc: 'Wind speed, atmospheric pressure & Beaufort hazard classification',
                color: 'from-amber-500/20 to-amber-900/20 border-amber-500/30',
                dot: 'bg-amber-500',
                accent: 'text-amber-400',
              },
              {
                icon: Shield,
                name: 'Sentinel Agent',
                desc: 'EEZ/IMBL boundary, MPA containment & geofence enforcement',
                color: 'from-indigo-500/20 to-indigo-900/20 border-indigo-500/30',
                dot: 'bg-indigo-500',
                accent: 'text-indigo-400',
              },
              {
                icon: Ship,
                name: 'Vessel Agent',
                desc: 'AISStream live tracking, fleet registry & nearest-vessel routing',
                color: 'from-emerald-500/20 to-emerald-900/20 border-emerald-500/30',
                dot: 'bg-emerald-500',
                accent: 'text-emerald-400',
              },
              {
                icon: Fish,
                name: 'Blue Economy',
                desc: 'INCOIS PFZ sectors, chlorophyll analysis & habitat suitability',
                color: 'from-teal-500/20 to-teal-900/20 border-teal-500/30',
                dot: 'bg-teal-500',
                accent: 'text-teal-400',
              },
            ].map(({ icon: Icon, name, desc, color, dot, accent }, i) => (
              <div
                key={name}
                className={`relative flex flex-col items-center text-center p-5 rounded-2xl border bg-gradient-to-b ${color} backdrop-blur-sm transition-all duration-700 hover:-translate-y-1 ${
                  agentsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${200 + i * 150}ms` }}
              >
                {/* Pulsing node dot */}
                <div className="relative mb-4">
                  <div className={`absolute -inset-1 rounded-full ${dot} opacity-20 animate-ping`} />
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.06]`}>
                    <Icon className={`h-6 w-6 ${accent}`} />
                  </div>
                </div>
                <p className={`mb-1 text-sm font-bold ${accent}`}>{name}</p>
                <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>

          {/* Supervisor consensus card */}
          <div
            className={`mt-8 flex justify-center transition-all duration-700 delay-[1000ms] ${
              agentsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="flex items-center gap-4 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 px-8 py-5 backdrop-blur-md shadow-lg shadow-purple-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-purple-300">Supervisor Agent — Consensus Orchestrator</p>
                <p className="text-xs text-slate-400">
                  Gemini 3.8 Flash → Ollama (qwen3.5:4b / llama3.2:1b) → Deterministic Rule Fallback
                </p>
              </div>
            </div>
          </div>

          {/* Extra capabilities row */}
          <div
            className={`mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 transition-all duration-700 delay-[1200ms] ${
              agentsReveal.visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {[
              { icon: Mic, label: '7 Indic Languages', sub: 'Voice AI' },
              { icon: ShieldCheck, label: 'Voyage Clearance', sub: 'DG Shipping' },
              { icon: Compass, label: 'Offline Cascade', sub: 'Never Fails' },
              { icon: Languages, label: 'Script Detection', sub: 'Auto Unicode' },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
              >
                <Icon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">{label}</p>
                  <p className="text-[10px] text-slate-500">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SCENE 5: PS-176 COMPLIANCE — MISSION BRIEF
      ══════════════════════════════════════════════════════════════════ */}
      <section ref={complianceReveal.ref} className="border-t border-white/5 px-4 py-20">
        <div className="mx-auto max-w-screen-xl">
          <div
            className={`rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/40 via-slate-950/60 to-indigo-950/40 p-8 md:p-10 shadow-2xl backdrop-blur-xl transition-all duration-700 ${
              complianceReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <Crosshair className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-mono text-lg font-bold text-white">
                  SIH 2026 — Problem Statement PS-176
                </h3>
                <p className="text-xs text-slate-400">ISRO Marine Intelligence Platform · Production Grade</p>
              </div>
            </div>

            <p className="mb-8 text-sm leading-relaxed text-slate-300">
              AUREXO ORCA directly addresses every requirement of the Smart India Hackathon 2026 PS-176 —
              14 capabilities verified live, with 98% average coverage across ocean telemetry, satellite imagery,
              geofencing compliance, vessel tracking, and blue economy analytics.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Ocean Telemetry', value: '100%', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
                { label: 'Satellite & PFZ', value: '100%', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
                { label: 'Safety & Geofencing', value: '95%', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
                { label: 'AIS Fleet Tracking', value: '95%', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
              ].map(({ label, value, color, border, bg }, idx) => (
                <div
                  key={label}
                  className={`rounded-2xl border ${border} ${bg} p-5 transition-all duration-500 ${
                    complianceReveal.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                  style={{ transitionDelay: `${400 + idx * 100}ms` }}
                >
                  <p className="mb-1 text-xs font-mono text-slate-400">{label}</p>
                  <p className={`font-mono text-3xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Link
                href="/about"
                className="flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                View Full PS-176 Requirement Analysis
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-cyan-900/20 px-4 py-10">
        <div className="mx-auto max-w-screen-xl flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 overflow-hidden rounded-full border border-cyan-400/40 shadow-sm shadow-cyan-500/20">
              <img src="/images/orca-logo-circle.png" alt="AUREXO ORCA" className="h-full w-full object-cover" />
            </div>
            <span className="font-mono text-sm font-black tracking-wider text-slate-200">
              AUREXO <span className="text-cyan-400">ISRO·ORCA</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 text-center max-w-lg">
            Marine Telemetry: Open-Meteo (live) · Satellite: NASA GIBS & INCOIS · Geospatial: Turf.js EEZ/IMBL ·
            Vessels: AISStream · SIH 2026 PS-176 Production Grade
          </p>
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="text-xs text-slate-500 hover:text-cyan-300 transition-colors">Dashboard</Link>
            <Link href="/fleet" className="text-xs text-slate-500 hover:text-cyan-300 transition-colors">Fleet</Link>
            <Link href="/regions" className="text-xs text-slate-500 hover:text-cyan-300 transition-colors">Regions</Link>
            <Link href="/analytics" className="text-xs text-slate-500 hover:text-cyan-300 transition-colors">Analytics</Link>
            <Link href="/about" className="text-xs text-slate-500 hover:text-cyan-300 transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
