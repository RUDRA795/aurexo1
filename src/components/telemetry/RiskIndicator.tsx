'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { GeofenceCheckResult } from '@/lib/types/domain';

interface RiskIndicatorProps {
  geofence?: GeofenceCheckResult | null;
  waveHeight?: number;
}

export function RiskIndicator({ geofence, waveHeight }: RiskIndicatorProps) {
  let status: 'SAFE' | 'CAUTION' | 'WARNING' | 'VIOLATION' = 'SAFE';
  let label = 'Waters Clear & Safe';
  let Icon = ShieldCheck;
  let colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (geofence?.riskStatus === 'Restricted Zone Violation') {
    status = 'VIOLATION';
    label = 'Restricted Marine Reserve';
    Icon = AlertOctagon;
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (geofence?.riskStatus === 'Border Proximity Warning') {
    status = 'WARNING';
    label = 'IMBL Proximity Warning';
    Icon = AlertTriangle;
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (geofence?.riskStatus === 'Caution' || (waveHeight && waveHeight >= 2.0)) {
    status = 'CAUTION';
    label = geofence?.riskStatus === 'Caution' ? 'Boundary Buffer Zone' : 'Rough Sea Advisory';
    Icon = Info;
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-pearl-sm ${colorClasses}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}
