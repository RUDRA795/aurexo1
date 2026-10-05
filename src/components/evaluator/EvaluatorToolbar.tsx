'use client';

import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Compass,
  Fish,
  Waves,
  FileCheck,
  Globe,
  Play,
  Terminal,
} from 'lucide-react';
import { GeoCoordinate } from '@/lib/types/domain';

export interface EvaluatorScenario {
  id: string;
  title: string;
  category: 'PFZ' | 'GEOFENCE' | 'WEATHER' | 'INDIC' | 'MANIFEST';
  prompt: string;
  coord?: GeoCoordinate;
  description: string;
  badge: string;
}

export const EVALUATOR_SCENARIOS: EvaluatorScenario[] = [
  {
    id: 'pfz-porbandar',
    title: '1. PFZ & Satellite Chlorophyll Front',
    category: 'PFZ',
    prompt: 'Where is the nearest Potential Fishing Zone (PFZ) near Porbandar coast and what are the oceanographic conditions?',
    coord: { latitude: 21.64, longitude: 69.62 },
    description: 'Correlates INCOIS PFZ advisory, satellite SST gradients (28.4°C), and chlorophyll-a for pelagic fish aggregations.',
    badge: 'Core Analysis',
  },
  {
    id: 'imbl-palk-bay',
    title: '2. IMBL Border Proximity Alert',
    category: 'GEOFENCE',
    prompt: 'Check vessel safety coordinates near Rameswaram Palk Strait. Are we approaching the Sri Lanka International Maritime Boundary Line?',
    coord: { latitude: 9.28, longitude: 79.31 },
    description: 'Deterministic Turf.js geodesic calculation against India-Sri Lanka IMBL boundary (12km red alert threshold).',
    badge: 'Geofence AI',
  },
  {
    id: 'mpa-gulf-mannar',
    title: '3. Marine Protected Area Violation',
    category: 'GEOFENCE',
    prompt: 'Is commercial trawling permitted inside the Gulf of Mannar Marine National Park zone?',
    coord: { latitude: 9.15, longitude: 79.20 },
    description: 'Deterministic point-in-polygon containment against 7 Marine Protected Areas under Wildlife Protection Act.',
    badge: 'Conservation',
  },
  {
    id: 'hazard-monsoon',
    title: '4. High Seas Hazard & Cyclone Warning',
    category: 'WEATHER',
    prompt: 'What are the current swell heights and wind advisories off the Konkan coast near Ratnagiri?',
    coord: { latitude: 16.99, longitude: 73.30 },
    description: 'Multi-agent weather fusion: significant wave height, wind gusts, and small craft seaworthiness rating.',
    badge: 'Fishermen Safety',
  },
  {
    id: 'indic-tamil',
    title: '5. Indic Regional Voice Reasoning (Tamil)',
    category: 'INDIC',
    prompt: 'இன்று சென்னை துறைமுகத்தில் அலை உயரம் மற்றும் மீன்பிடி பாதுகாப்பு எப்படி உள்ளது?',
    coord: { latitude: 13.12, longitude: 80.30 },
    description: 'Automated Unicode script detection, Tamil natural language response, and Web Speech API synthesis.',
    badge: 'Multilingual AI',
  },
];

interface EvaluatorToolbarProps {
  onRunScenario: (scenario: EvaluatorScenario) => void;
  onOpenManifest: () => void;
}

export function EvaluatorToolbar({ onRunScenario, onOpenManifest }: EvaluatorToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-5xl w-[96%] md:w-auto">
      <div className="rounded-2xl glass-pearl border border-marine-200/80 shadow-pearl-lg overflow-hidden backdrop-blur-xl">

        {/* Toggle Ribbon */}
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-gradient-to-r from-marine-900 via-marine-800 to-slate-900 text-white cursor-pointer select-none"
             onClick={() => setIsExpanded((p) => !p)}>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-400 text-marine-950 font-black text-[10px] shadow-sm">
              ✓
            </div>
            <span className="text-xs font-bold tracking-tight text-cyan-200">
              AUREXO Benchmark Suite
            </span>
            <span className="hidden sm:inline-block rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-mono font-medium text-cyan-300 border border-cyan-400/30">
              Production Ready
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenManifest();
              }}
              className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow transition-all hover:scale-102 active:scale-98"
            >
              <FileCheck className="h-3 w-3" />
              <span>Clearance Manifest</span>
            </button>

            <button
              type="button"
              className="p-1 rounded-md text-cyan-200 hover:bg-white/10 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Quick Scenarios */}
        {isExpanded && (
          <div className="p-3 bg-white/95 space-y-2 border-t border-marine-100">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>One-Click Reference Scenarios (Multi-Agent Swarm + Deterministic GIS):</span>
              <span className="text-[10px] font-mono text-emerald-600 font-semibold">100% PRODUCTION READY</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {EVALUATOR_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    onRunScenario(sc);
                    setIsExpanded(false);
                  }}
                  className="flex flex-col text-left p-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-marine-50/70 hover:border-marine-300 transition-all hover:scale-101 active:scale-98 group shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-marine-700 line-clamp-1">
                      {sc.title}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium group-hover:bg-marine-100 group-hover:text-marine-700">
                      {sc.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                    {sc.description}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-marine-600 group-hover:text-marine-800">
                    <Play className="h-2.5 w-2.5 fill-current" />
                    <span>Run Live Verification</span>
                  </div>
                </button>
              ))}

              {/* Extra Card: Open Voyage Manifest */}
              <button
                onClick={() => {
                  onOpenManifest();
                  setIsExpanded(false);
                }}
                className="flex flex-col text-left p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 hover:border-emerald-300 transition-all hover:scale-101 active:scale-98 group shadow-2xs"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-emerald-900 group-hover:text-emerald-950">
                    6. Voyage Clearance Manifest
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-200/70 text-emerald-800 font-bold">
                    Official PDF
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800/80 line-clamp-2 leading-relaxed">
                  Generate digital Port State Control safety clearance certificate with weather and border audits.
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-700 group-hover:text-emerald-900">
                  <FileCheck className="h-2.5 w-2.5" />
                  <span>Launch Manifest Auditor</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
