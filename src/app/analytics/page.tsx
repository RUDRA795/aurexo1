'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Fish,
  Thermometer,
  Waves,
  MapPin,
  ChevronRight,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';

// Reference PFZ zones (static INCOIS guideline sectors)
const PFZ_ZONES = [
  {
    id: 'PFZ-GUJ-01',
    name: 'Porbandar - Veraval',
    region: 'Saurashtra & Kutch',
    lat: 21.20,
    lon: 69.20,
    distanceKm: 38,
    depth: 65,
    species: ['Yellowfin Tuna', 'Ribbonfish', 'Indian Mackerel'],
    chlorophyllStatus: 'Moderate gradient (0.4–0.8 mg/m³)',
    quality: 72,
  },
  {
    id: 'PFZ-MAH-01',
    name: 'Mumbai - Alibaug Outer Shelf',
    region: 'Konkan',
    lat: 18.80,
    lon: 72.40,
    distanceKm: 42,
    depth: 55,
    species: ['Silver Pomfret', 'Seer Fish', 'Bombay Duck'],
    chlorophyllStatus: 'Elevated ocean color front along thermal break',
    quality: 85,
  },
  {
    id: 'PFZ-KER-01',
    name: 'Kochi - Alleppey Upwelling',
    region: 'Malabar',
    lat: 9.80,
    lon: 75.80,
    distanceKm: 28,
    depth: 45,
    species: ['Indian Oil Sardine', 'Horse Mackerel', 'Squid'],
    chlorophyllStatus: 'Strong coastal upwelling signature',
    quality: 91,
  },
  {
    id: 'PFZ-TN-01',
    name: 'Coromandel Central (Pondicherry)',
    region: 'Coromandel',
    lat: 11.50,
    lon: 80.20,
    distanceKm: 32,
    depth: 60,
    species: ['Tuna', 'Carangids', 'Snappers'],
    chlorophyllStatus: 'Ocean thermal front at 50m isobath',
    quality: 78,
  },
];

// Coastal port fish landing data (reference from CMFRI annual reports)
const LANDING_DATA = [
  { port: 'Kochi', tonnesK: 142 },
  { port: 'Chennai', tonnesK: 118 },
  { port: 'Visakhapatnam', tonnesK: 97 },
  { port: 'Mumbai', tonnesK: 89 },
  { port: 'Mangalore', tonnesK: 76 },
  { port: 'Tuticorin', tonnesK: 62 },
];

interface LiveConditions {
  wave: number;
  wind: number;
  sst: number;
}

const RADAR_REGIONS = [
  { region: 'Saurashtra', lat: 22.3, lon: 69.6 },
  { region: 'Konkan', lat: 17.5, lon: 73.3 },
  { region: 'Malabar', lat: 11.25, lon: 75.78 },
  { region: 'Coromandel', lat: 11.5, lon: 80.2 },
  { region: 'Andaman', lat: 11.7, lon: 92.7 },
];

export default function AnalyticsPage() {
  const [liveConditions, setLiveConditions] = useState<Record<string, LiveConditions>>({});
  const [loadingConditions, setLoadingConditions] = useState(true);
  const [radarData, setRadarData] = useState<{ region: string; wave: number; wind: number; sst: number }[]>([]);

  const fetchConditions = async () => {
    setLoadingConditions(true);
    const results: Record<string, LiveConditions> = {};
    const radar: typeof radarData = [];

    await Promise.allSettled(
      RADAR_REGIONS.map(async ({ region, lat, lon }) => {
        try {
          const res = await fetch(`/api/marine/conditions?lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const d = await res.json();
            const entry: LiveConditions = {
              wave: d.wave?.heightMeters ?? 0,
              wind: d.wind?.speedKmh ?? 0,
              sst: d.sst?.temperatureCelsius ?? 0,
            };
            results[region] = entry;
            radar.push({ region, wave: entry.wave * 10, wind: entry.wind, sst: entry.sst });
          }
        } catch {/* skip */}
      })
    );

    setLiveConditions(results);
    setRadarData(radar);
    setLoadingConditions(false);
  };

  useEffect(() => { fetchConditions(); }, []);

  const qualityColor = (q: number) => {
    if (q >= 85) return '#10b981';
    if (q >= 70) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24 text-slate-100">
      <div className="mx-auto max-w-screen-xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-mono text-slate-300">
              <BarChart3 className="h-3.5 w-3.5 text-slate-200" />
              ANALYTICS — BLUE ECONOMY & OCEAN INTELLIGENCE
            </div>
            <h1 className="mb-2 font-mono text-3xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">Marine Analytics</h1>
            <p className="text-sm text-slate-200 drop-shadow">
              Potential Fishing Zones, regional ocean conditions, fish landing estimates — INCOIS/CMFRI reference data.
            </p>
          </div>
          <button
            onClick={fetchConditions}
            disabled={loadingConditions}
            className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/25 hover:border-white/40 disabled:opacity-50"
          >
            {loadingConditions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        {/* PFZ Grid */}
        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <Fish className="h-5 w-5 text-amber-300" />
            <h2 className="font-mono text-xl font-bold text-white drop-shadow">Potential Fishing Zones</h2>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-mono text-amber-300">
              INCOIS REFERENCE
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {PFZ_ZONES.map((z) => (
              <div key={z.id} className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md transition-all hover:bg-white/[0.14] hover:border-white/35 hover:-translate-y-0.5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-mono text-slate-300">{z.id}</p>
                    <h3 className="mt-0.5 text-sm font-semibold text-white leading-tight">{z.name}</h3>
                    <p className="text-[10px] text-slate-300">{z.region}</p>
                  </div>
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold shadow-sm"
                    style={{ backgroundColor: `${qualityColor(z.quality)}20`, color: qualityColor(z.quality), border: `1px solid ${qualityColor(z.quality)}40` }}
                  >
                    {z.quality}
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-slate-300">Distance</p>
                    <p className="font-mono text-sm font-bold text-white">{z.distanceKm} km</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-slate-300">Depth</p>
                    <p className="font-mono text-sm font-bold text-white">{z.depth} m</p>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-200">
                  <MapPin className="h-3 w-3 text-slate-300" />
                  {z.lat}°N, {z.lon}°E
                </div>

                <div className="mb-3">
                  <p className="mb-1 text-[10px] text-slate-300">Target Species</p>
                  <div className="flex flex-wrap gap-1">
                    {z.species.map((s) => (
                      <span key={s} className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">{s}</span>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] italic text-slate-300">{z.chlorophyllStatus}</p>

                <div className="mt-3">
                  <Link
                    href={`/dashboard?q=Show PFZ near ${z.name}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    <Fish className="h-3.5 w-3.5 text-slate-200" />
                    View on map <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fish Landing Bar Chart */}
        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h2 className="font-mono text-xl font-bold text-white">Marine Fish Landing</h2>
            <span className="rounded-full border border-slate-600/30 bg-slate-800/30 px-2 py-0.5 text-[10px] font-mono text-slate-400">
              CMFRI REFERENCE
            </span>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
            <p className="mb-4 text-xs text-slate-500">Estimated annual fish landing by major Indian fishing ports (× 1,000 tonnes)</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={LANDING_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="port" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  formatter={(v: unknown) => [`${v as number}K tonnes`, 'Landing']}
                />
                <Bar dataKey="tonnesK" radius={[6, 6, 0, 0]}>
                  {LANDING_DATA.map((_, i) => (
                    <Cell key={i} fill={`hsl(${185 + i * 12}, 70%, ${50 + i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Live Regional Conditions Radar */}
        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <Waves className="h-5 w-5 text-blue-400" />
            <h2 className="font-mono text-xl font-bold text-white">Live Regional Ocean Conditions</h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              OPEN-METEO LIVE
            </span>
          </div>

          {loadingConditions ? (
            <div className="flex items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/40 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Radar chart */}
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                <p className="mb-3 text-xs text-slate-500">Wind speed (km/h) across 5 key regions</p>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="region" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Radar name="Wind" dataKey="wind" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Live conditions table */}
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                <p className="mb-4 text-xs text-slate-500">Current readings — 5 maritime sectors</p>
                <div className="space-y-3">
                  {RADAR_REGIONS.map(({ region }) => {
                    const c = liveConditions[region];
                    return (
                      <div key={region} className="flex items-center justify-between rounded-xl bg-slate-800/40 px-4 py-3">
                        <p className="text-sm font-medium text-white">{region}</p>
                        {c ? (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1 text-blue-400">
                              <Waves className="h-3 w-3" /> {c.wave.toFixed(1)}m
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                              Wind {c.wind.toFixed(0)} km/h
                            </span>
                            <span className="flex items-center gap-1 text-orange-400">
                              <Thermometer className="h-3 w-3" /> {c.sst.toFixed(1)}°C
                            </span>
                          </div>
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
