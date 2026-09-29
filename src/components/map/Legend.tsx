'use client';

import React from 'react';
import { SATELLITE_LAYERS } from '@/lib/tools/satellite-layers';
import { SatelliteLayerId } from '@/lib/types/domain';

interface LegendProps {
  activeLayer: SatelliteLayerId;
}

export function Legend({ activeLayer }: LegendProps) {
  const layer = SATELLITE_LAYERS[activeLayer];
  if (!layer || !layer.legend) return null;

  return (
    <div className="glass-pearl rounded-xl px-3 py-2 text-xs text-slate-700 shadow-pearl-sm">
      <div className="flex items-center justify-between font-medium text-slate-800 mb-1">
        <span>{layer.name}</span>
        <span className="text-[10px] text-slate-500">{layer.legend.unit}</span>
      </div>
      <div
        className="h-2 w-36 rounded-full border border-slate-300/40"
        style={{ background: layer.legend.gradient }}
      />
      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
        <span>{layer.legend.min}</span>
        <span>{layer.legend.max}</span>
      </div>
    </div>
  );
}
