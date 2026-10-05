'use client';

import React from 'react';
import { X, Cpu, CheckCircle2, AlertTriangle, Clock, Activity, ShieldCheck, Compass } from 'lucide-react';
import { AgentName, AgentStep, AgentSwarmTrace } from '@/lib/types/agents';

interface AgentInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  trace?: AgentSwarmTrace | null;
}

function getAgentBadge(name: AgentName) {
  switch (name) {
    case 'Ocean':
      return {
        bg: 'bg-cyan-50 border-cyan-200 text-cyan-800',
        dot: 'bg-cyan-500',
        label: 'Ocean Agent',
      };
    case 'WeatherHazard':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        dot: 'bg-amber-500',
        label: 'Weather & Hazard',
      };
    case 'SpatialSentinel':
      return {
        bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        dot: 'bg-indigo-500',
        label: 'Spatial Sentinel',
      };
    case 'Vessel':
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        dot: 'bg-emerald-500',
        label: 'Vessel Tracking',
      };
    case 'BlueEconomy':
      return {
        bg: 'bg-teal-50 border-teal-200 text-teal-800',
        dot: 'bg-teal-500',
        label: 'Blue Economy (PFZ)',
      };
    case 'Supervisor':
    default:
      return {
        bg: 'bg-purple-50 border-purple-200 text-purple-800',
        dot: 'bg-purple-500',
        label: 'Supervisor Consensus',
      };
  }
}

function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />;
  }
  if (status === 'flagged') {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />;
  }
  return <Activity className="h-3.5 w-3.5 text-marine-600 animate-spin flex-shrink-0" />;
}

export function AgentInspector({ isOpen, onClose, trace }: AgentInspectorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed right-3 sm:right-6 top-[132px] sm:top-[140px] z-30 w-80 sm:w-96 rounded-2xl glass-pearl shadow-pearl-lg border border-slate-200/80 overflow-hidden flex flex-col max-h-[calc(100vh-11rem)] max-h-[740px] animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 bg-white/70">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-marine-50 border border-marine-200 text-marine-700">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Multi-Agent Swarm Telemetry</h3>
            <p className="text-[10px] text-slate-500">Collaborative Reasoning & Consensus</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Close Inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Consensus Summary Banner */}
      {trace && (
        <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/60 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold">Consensus Reached</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
            <Clock className="h-3 w-3" />
            <span>{trace.durationMs}ms</span>
          </div>
        </div>
      )}

      {/* Steps Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!trace || trace.steps.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <Compass className="h-8 w-8 mx-auto text-slate-300 mb-2 animate-pulse" />
            No agent swarm activity recorded yet.
            <br />
            Ask a query in the copilot to view inter-agent handoffs.
          </div>
        ) : (
          trace.steps.map((step, idx) => {
            const badge = getAgentBadge(step.agentName);
            return (
              <div
                key={idx}
                className="relative pl-5 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-[1.5px] before:bg-slate-200 last:before:hidden"
              >
                {/* Node Dot */}
                <div className={`absolute left-0.5 top-1 h-3 w-3 rounded-full border-2 border-white ${badge.dot} shadow-xs`} />

                <div className="rounded-xl border border-slate-200/70 bg-white/90 p-2.5 shadow-pearl-sm text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <StepStatusIcon status={step.status} />
                  </div>

                  <div className="font-semibold text-slate-800 text-[11px] pt-0.5">
                    {step.action}
                  </div>

                  <div className="text-[10px] text-slate-600 leading-relaxed">
                    {step.detail}
                  </div>

                  <div className="text-[9px] text-slate-400 font-mono text-right pt-0.5">
                    {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {trace && (
        <div className="border-t border-slate-200/60 p-2.5 bg-slate-50/70 text-[10px] text-slate-500 font-sans text-center">
          {trace.consensusSummary}
        </div>
      )}
    </div>
  );
}
