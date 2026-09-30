'use client';

import React from 'react';
import { Layers, Globe, Thermometer, Waves, ShieldAlert, Fish, Navigation } from 'lucide-react';
import { SatelliteLayerId } from '@/lib/types/domain';
import { SATELLITE_LAYERS } from '@/lib/tools/satellite-layers';

interface LayerControllerProps {
  activeLayer: SatelliteLayerId;
  onSelectLayer: (layer: SatelliteLayerId) => void;
  showBoundaries: boolean;
  onToggleBoundaries: () => void;
  showMPAs: boolean;
  onToggleMPAs: () => void;
  showPFZSectors: boolean;
  onTogglePFZSectors: () => void;
  showVessels?: boolean;
  onToggleVessels?: () => void;
}

export function LayerController({
  activeLayer,
  onSelectLayer,
  showBoundaries,
  onToggleBoundaries,
  showMPAs,
  onToggleMPAs,
  showPFZSectors,
  onTogglePFZSectors,
  showVessels = true,
  onToggleVessels,
}: LayerControllerProps) {
  return (
    <div className="glass-pearl flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5 shadow-pearl-md">
      <div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 border-r border-slate-200/80 mr-1">
        <Layers className="h-3.5 w-3.5 text-marine-600" />
        <span className="hidden sm:inline">Layers</span>
      </div>

      {/* Layer Pills */}
      <button
        onClick={() => onSelectLayer('none')}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          activeLayer === 'none'
            ? 'bg-marine-600 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title={SATELLITE_LAYERS.none.description}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>Base</span>
      </button>

      <button
        onClick={() => onSelectLayer('truecolor')}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          activeLayer === 'truecolor'
            ? 'bg-marine-600 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title={SATELLITE_LAYERS.truecolor.description}
      >
        <Globe className="h-3.5 w-3.5 text-amber-500" />
        <span>TrueColor</span>
      </button>

      <button
        onClick={() => onSelectLayer('sst')}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          activeLayer === 'sst'
            ? 'bg-marine-600 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title={SATELLITE_LAYERS.sst.description}
      >
        <Thermometer className="h-3.5 w-3.5 text-rose-500" />
        <span>SST</span>
      </button>

      <button
        onClick={() => onSelectLayer('chlorophyll')}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          activeLayer === 'chlorophyll'
            ? 'bg-marine-600 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title={SATELLITE_LAYERS.chlorophyll.description}
      >
        <Waves className="h-3.5 w-3.5 text-emerald-500" />
        <span>Chlorophyll</span>
      </button>

      <button
        onClick={() => onSelectLayer('incois_coral')}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          activeLayer === 'incois_coral'
            ? 'bg-marine-600 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title={SATELLITE_LAYERS.incois_coral.description}
      >
        <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
        <span>INCOIS Reefs</span>
      </button>

      <button
        onClick={() => onSelectLayer('incois_pfz')}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          activeLayer === 'incois_pfz'
            ? 'bg-marine-600 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title={SATELLITE_LAYERS.incois_pfz.description}
      >
        <Fish className="h-3.5 w-3.5 text-cyan-600" />
        <span>INCOIS PFZ</span>
      </button>

      <div className="h-4 w-[1px] bg-slate-200/80 mx-1 hidden sm:block" />

      {/* Vector Overlays */}
      <button
        onClick={onToggleBoundaries}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          showBoundaries
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title="Toggle Indian EEZ and International Maritime Boundary Lines (IMBL)"
      >
        <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
        <span>IMBL/EEZ</span>
      </button>

      <button
        onClick={onToggleMPAs}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          showMPAs
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title="Toggle Marine Protected Areas (Strict conservation zones)"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
        <span>MPAs</span>
      </button>

      <button
        onClick={onTogglePFZSectors}
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
          showPFZSectors
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100/80'
        }`}
        title="Toggle Coastal Potential Fishing Sectors"
      >
        <Fish className="h-3.5 w-3.5 text-sky-500" />
        <span>PFZ</span>
      </button>

      {onToggleVessels && (
        <button
          onClick={onToggleVessels}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
            showVessels
              ? 'bg-marine-700 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100/80'
          }`}
          title="Toggle Real-Time Vessel Fleet Layer"
        >
          <Navigation className="h-3.5 w-3.5 text-emerald-400 rotate-45" />
          <span>Fleet</span>
        </button>
      )}
    </div>
  );
}
