'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Globe2,
  AlertTriangle,
  CheckCircle,
  Waves,
  Wind,
  Thermometer,
  Navigation,
  ChevronRight,
  RefreshCw,
  Loader2,
  Map,
} from 'lucide-react';
import { MaritimeRegion } from '@/lib/types/regions';

// All 9 region IDs and their display meta
const REGION_META: { id: string; sector: string; color: string }[] = [
  { id: 'saurashtra_kutch', sector: 'West — Arabian Sea North', color: 'from-orange-500/10 to-yellow-500/10 border-orange-500/30' },
  { id: 'konkan', sector: 'West — Arabian Sea Central', color: 'from-cyan-500/10 to-blue-500/10 border-cyan-500/30' },
  { id: 'goa_karavali', sector: 'West — Arabian Sea South-Central', color: 'from-teal-500/10 to-green-500/10 border-teal-500/30' },
  { id: 'malabar', sector: 'West — Arabian Sea South', color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/30' },
  { id: 'palk_gulf_mannar', sector: 'South — Palk Strait', color: 'from-purple-500/10 to-pink-500/10 border-purple-500/30' },
  { id: 'coromandel', sector: 'East — Bay of Bengal Central', color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/30' },
  { id: 'andhra_coast', sector: 'East — Bay of Bengal North-Central', color: 'from-indigo-500/10 to-violet-500/10 border-indigo-500/30' },
  { id: 'utkal_bengal', sector: 'East — Bay of Bengal North', color: 'from-violet-500/10 to-purple-500/10 border-violet-500/30' },
  { id: 'island_territories', sector: 'Andaman & Nicobar / Lakshadweep', color: 'from-pink-500/10 to-rose-500/10 border-pink-500/30' },
];

interface RegionConditions {
  wave: { heightMeters: number; category: string };
  wind: { speedKmh: number; beaufortScale: number; beaufortDescription: string };
  sst?: { temperatureCelsius: number };
  overallRisk?: string;
  warnings?: string[];
  loaded: boolean;
}

interface RegionDisplay extends MaritimeRegion {
  meta: typeof REGION_META[number];
  conditions: RegionConditions;
}

export default function RegionsPage() {
  const [regions, setRegions] = useState<RegionDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const loadAllRegions = async () => {
    setRefreshing(true);
    try {
      // Fetch region definitions
      const regRes = await fetch('/api/regions?action=list');
      const regData = regRes.ok ? await regRes.json() : { regions: [] };
      const regionList: MaritimeRegion[] = regData.regions ?? [];

      // Build display array with meta
      const display: RegionDisplay[] = REGION_META.map((meta) => {
        const found = regionList.find((r: MaritimeRegion) => r.id === meta.id);
        return {
          ...(found ?? {
            id: meta.id,
            name: meta.id.replace(/_/g, ' ').toUpperCase(),
            state: 'India',
            sea: 'Arabian Sea' as const,
            description: '',
            center: { latitude: 15, longitude: 75 },
            boundingBox: { minLat: 5, maxLat: 30, minLon: 60, maxLon: 100 },
            primaryPorts: [],
            vulnerableHazards: [],
          }),
          meta,
          conditions: { wave: { heightMeters: 0, category: 'Calm' }, wind: { speedKmh: 0, beaufortScale: 0, beaufortDescription: 'Calm' }, loaded: false },
        } as RegionDisplay;
      });

      setRegions(display);
      setLoading(false);

      // Now fetch live conditions for each region's centroid
      const updated = await Promise.all(
        display.map(async (r) => {
          const region = r as RegionDisplay;
          try {
            const c = region.center ?? { latitude: 15, longitude: 75 };
            const res = await fetch(`/api/marine/conditions?lat=${c.latitude}&lon=${c.longitude}`);
            if (!res.ok) return region;
            const d = await res.json();
            return {
              ...region,
              conditions: {
                wave: d.wave ?? { heightMeters: 0, category: 'Calm' },
                wind: d.wind ?? { speedKmh: 0, beaufortScale: 0, beaufortDescription: 'Calm' },
                sst: d.sst,
                loaded: true,
              },
            };
          } catch {
            return region;
          }
        })
      );

      setRegions(updated);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to load regions:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllRegions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRiskColor = (wave: number, wind: number) => {
    if (wave >= 2.5 || wind >= 38) return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'ROUGH SEA', icon: AlertTriangle };
    if (wave >= 1.5 || wind >= 25) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'MODERATE', icon: AlertTriangle };
    return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'CALM', icon: CheckCircle };
  };

  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24 text-slate-100">
      <div className="mx-auto max-w-screen-xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-mono text-slate-300">
              <Globe2 className="h-3.5 w-3.5 text-slate-200" />
              MARITIME REGIONS — INDIA COASTAL WATERS
            </div>
            <h1 className="mb-2 font-mono text-3xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              9 Indian Coastal Sectors
            </h1>
            <p className="text-sm text-slate-200 drop-shadow">
              Real-time marine conditions for all Indian maritime sectors — from Saurashtra to Andaman Islands.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={loadAllRegions}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/25 hover:border-white/40 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
            {lastUpdated && (
              <p className="text-xs text-slate-300">Updated {lastUpdated}</p>
            )}
          </div>
        </div>

        {/* Summary Bar */}
        {!loading && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {(() => {
              const rough = regions.filter((r) => r.conditions.wave.heightMeters >= 2.5 || r.conditions.wind.speedKmh >= 38).length;
              const moderate = regions.filter((r) => r.conditions.wave.heightMeters >= 1.5 && r.conditions.wave.heightMeters < 2.5).length;
              const calm = regions.length - rough - moderate;
              return (
                <>
                  <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
                    <p className="mb-1 text-xs font-medium text-slate-300">Calm Sectors</p>
                    <p className="font-mono text-3xl font-bold text-emerald-400">{calm}</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
                    <p className="mb-1 text-xs font-medium text-slate-300">Moderate Sectors</p>
                    <p className="font-mono text-3xl font-bold text-amber-300">{moderate}</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
                    <p className="mb-1 text-xs font-medium text-slate-300">Rough Sea Sectors</p>
                    <p className="font-mono text-3xl font-bold text-rose-400">{rough}</p>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Region Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {regions.map((region) => {
              const risk = getRiskColor(
                region.conditions.wave.heightMeters,
                region.conditions.wind.speedKmh
              );
              const RiskIcon = risk.icon;
              return (
                <div
                  key={region.id}
                  className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] p-6 shadow-xl backdrop-blur-md transition-all hover:bg-white/[0.13] hover:border-white/35 hover:-translate-y-0.5"
                >
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-mono text-slate-300">{region.meta.sector}</p>
                      <h3 className="mt-0.5 font-semibold text-white leading-tight text-base">
                        {region.name ?? region.id.replace(/_/g, ' ')}
                      </h3>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${risk.bg} ${risk.border} shadow-sm`}>
                      <RiskIcon className={`h-3 w-3 ${risk.text}`} />
                      <span className={`text-[10px] font-mono font-semibold ${risk.text}`}>
                        {risk.label}
                      </span>
                    </div>
                  </div>

                  {/* Conditions */}
                  {region.conditions.loaded ? (
                    <div className="grid grid-cols-3 gap-2.5 my-3">
                      <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
                        <div className="mb-1 flex items-center justify-center gap-1 text-[10px] text-slate-300">
                          <Waves className="h-3 w-3 text-sky-400" /> Wave
                        </div>
                        <p className="font-mono text-sm font-bold text-white">
                          {region.conditions.wave.heightMeters.toFixed(1)}m
                        </p>
                        <p className="text-[10px] text-slate-300">{region.conditions.wave.category}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
                        <div className="mb-1 flex items-center justify-center gap-1 text-[10px] text-slate-300">
                          <Wind className="h-3 w-3 text-slate-300" /> Wind
                        </div>
                        <p className="font-mono text-sm font-bold text-white">
                          {region.conditions.wind.speedKmh.toFixed(0)} km/h
                        </p>
                        <p className="text-[10px] text-slate-300">BF {region.conditions.wind.beaufortScale}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
                        <div className="mb-1 flex items-center justify-center gap-1 text-[10px] text-slate-300">
                          <Thermometer className="h-3 w-3 text-amber-400" /> SST
                        </div>
                        <p className="font-mono text-sm font-bold text-white">
                          {region.conditions.sst ? `${region.conditions.sst.temperatureCelsius.toFixed(1)}°C` : '—'}
                        </p>
                        <p className="text-[10px] text-slate-300">Surface</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-4 text-xs text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Fetching live conditions…
                    </div>
                  )}

                  {/* Ports preview */}
                  {region.primaryPorts && region.primaryPorts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {region.primaryPorts.slice(0, 3).map((p: string) => (
                        <span
                          key={p}
                          className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] text-slate-200"
                        >
                          {p}
                        </span>
                      ))}
                      {region.primaryPorts.length > 3 && (
                        <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                          +{region.primaryPorts.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ask ORCA link */}
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/dashboard?q=What is happening around ${region.name ?? region.id}?`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition-all shadow-sm"
                    >
                      <Navigation className="h-3.5 w-3.5 text-slate-200" />
                      Ask ORCA about this region
                      <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Map Link */}
        <div className="mt-12 flex justify-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl transition-all hover:bg-slate-100 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            <Map className="h-4 w-4" />
            View all regions on Map
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
