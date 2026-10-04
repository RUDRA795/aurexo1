'use client';

import React from 'react';
import { Compass, Waves, Wind, Thermometer, Radio, Cpu, Activity, FileCheck } from 'lucide-react';
import { MarineObservation, GeofenceCheckResult } from '@/lib/types/domain';
import { RiskIndicator } from './RiskIndicator';

interface MarineHUDProps {
  currentObservation?: MarineObservation | null;
  geofence?: GeofenceCheckResult | null;
  isLoadingConditions?: boolean;
  activeProvider?: string;
  onToggleInspector?: () => void;
  isInspectorOpen?: boolean;
  swarmStepsCount?: number;
  onOpenManifest?: () => void;
}

export function MarineHUD({
  currentObservation,
  geofence,
  isLoadingConditions,
  activeProvider = 'gemini-3.8-flash',
  onToggleInspector,
  isInspectorOpen,
  swarmStepsCount,
  onOpenManifest,
}: MarineHUDProps) {
  const wave = currentObservation?.wave;
  const wind = currentObservation?.wind;
  const sst = currentObservation?.seaSurfaceTemperatureCelsius;
  const coord = currentObservation?.coordinates;

  return (
    <header className="glass-pearl flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5 shadow-pearl-md">
      {/* Brand Identity */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/30 overflow-hidden shadow-sm">
          <img src="/images/orca-logo-circle.png" alt="ORCA" className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold tracking-tight text-slate-900">ORCA</span>
            <span className="rounded bg-marine-100 px-1.5 py-0.2 text-[10px] font-semibold text-marine-700">
              SIH26176
            </span>
          </div>
          <p className="text-[10px] font-medium text-slate-500">
            {currentObservation?.locationName ?? 'Collaborative Marine Intelligence'}
          </p>
        </div>
      </div>

      {/* Live Marine Telemetry Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Coordinates */}
        {coord && (
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 px-2.5 py-1 text-xs font-mono text-slate-700">
            <span className="text-slate-400">LAT:</span>
            <span>{coord.latitude.toFixed(2)}°N</span>
            <span className="text-slate-400 ml-1">LON:</span>
            <span>{coord.longitude.toFixed(2)}°E</span>
          </div>
        )}

        {/* Wave Height Badge */}
        {wave && (
          <div className="flex items-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-50/80 px-2.5 py-1 text-xs font-semibold text-sky-800">
            <Waves className="h-3.5 w-3.5 text-sky-600" />
            <span>{wave.heightMeters.toFixed(1)}m</span>
            <span className="text-[10px] font-normal text-sky-600">({wave.category})</span>
          </div>
        )}

        {/* Wind Speed Badge */}
        {wind && (
          <div className="flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-2.5 py-1 text-xs font-semibold text-indigo-800">
            <Wind className="h-3.5 w-3.5 text-indigo-600" />
            <span>{wind.speedKmh.toFixed(0)} km/h</span>
            <span className="text-[10px] font-normal text-indigo-600">
              (Bft {wind.beaufortScale})
            </span>
          </div>
        )}

        {/* Sea Surface Temperature Badge */}
        {sst !== undefined && (
          <div className="flex items-center gap-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 px-2.5 py-1 text-xs font-semibold text-rose-800">
            <Thermometer className="h-3.5 w-3.5 text-rose-600" />
            <span>{sst.toFixed(1)}°C</span>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoadingConditions && (
          <div className="flex items-center gap-1 text-xs font-medium text-marine-600 animate-pulse">
            <Radio className="h-3.5 w-3.5 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
      </div>

      {/* Status, Inspector Toggle & Active LLM Info */}
      <div className="flex items-center gap-2">
        <RiskIndicator geofence={geofence} waveHeight={wave?.heightMeters} />

        {onOpenManifest && (
          <button
            onClick={onOpenManifest}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold transition-all hover:scale-102 active:scale-98"
            title="Generate Digital Port State Control Voyage Clearance"
          >
            <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden md:inline">Voyage Manifest</span>
          </button>
        )}

        {onToggleInspector && (
          <button
            onClick={onToggleInspector}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-all ${
              isInspectorOpen
                ? 'bg-marine-700 text-white shadow-sm'
                : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200'
            }`}
            title="Inspect Collaborative Agent Swarm Reasoning"
          >
            <Activity className="h-3.5 w-3.5 text-marine-500" />
            <span>Swarm</span>
            {swarmStepsCount !== undefined && swarmStepsCount > 0 && (
              <span className="rounded-full bg-marine-500 text-white px-1 text-[9px] font-mono">
                {swarmStepsCount}
              </span>
            )}
          </button>
        )}

        <div
          className="hidden sm:flex items-center gap-1 rounded-xl bg-slate-100/90 px-2.5 py-1 text-[11px] font-medium text-slate-600"
          title="Active LLM Reasoning Engine"
        >
          <Cpu className="h-3 w-3 text-marine-600" />
          <span>{activeProvider}</span>
        </div>
      </div>
    </header>
  );
}
