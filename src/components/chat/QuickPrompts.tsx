'use client';

import React from 'react';
import { Compass, Waves, ShieldAlert, Fish, Navigation } from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const DEMO_PROMPTS = [
  {
    icon: Waves,
    label: 'Mumbai Waves & Conditions',
    query: 'What are the current marine and wave conditions off the coast of Mumbai?',
  },
  {
    icon: Compass,
    label: 'Porbandar SST & Sea State',
    query: 'Check sea surface temperature and wave safety off Porbandar Gujarat',
  },
  {
    icon: ShieldAlert,
    label: 'Rameswaram IMBL Border Check',
    query: 'Is it safe to venture 10km south-west from Rameswaram towards Sri Lanka border?',
  },
  {
    icon: Fish,
    label: 'Gujarat Potential Fishing Zones',
    query: 'Show me potential fishing zones in Gujarat sector and target species',
  },
  {
    icon: Navigation,
    label: 'Simulate Safe Route Passage',
    query: 'Calculate a safe navigational passage corridor from Mumbai to South Konkan',
  },
];

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
        Quick Maritime Inquiries
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DEMO_PROMPTS.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => onSelectPrompt(p.query)}
              className="flex items-center gap-1 rounded-xl bg-white/70 hover:bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-pearl-sm border border-slate-200/60 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-left"
            >
              <Icon className="h-3 w-3 text-marine-600 flex-shrink-0" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
