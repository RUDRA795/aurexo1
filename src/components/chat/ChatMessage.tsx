'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Sparkles,
  Activity,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AgentResponse, IntegrationStatus } from '@/lib/types/domain';
import { AgentSwarmTrace } from '@/lib/types/agents';
import { detectIndicLanguage, speakText } from '@/lib/utils/indic-voice';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    agentData?: AgentResponse;
    timestamp: string;
  };
  onSelectPrompt?: (prompt: string) => void;
  onInspectSwarm?: (trace: AgentSwarmTrace) => void;
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === 'VERIFIED_LIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-2.5 w-2.5" />
        VERIFIED LIVE
      </span>
    );
  }
  if (status === 'DOCUMENTED_UNVERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
        <AlertCircle className="h-2.5 w-2.5" />
        DOCUMENTED UNVERIFIED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
      UNAVAILABLE
    </span>
  );
}

export function ChatMessage({ message, onSelectPrompt, onInspectSwarm }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [showEvidence, setShowEvidence] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const agent = message.agentData;

  const detectedLanguage = detectIndicLanguage(message.content);

  useEffect(() => {
    return () => {
      if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    speakText(
      message.content,
      detectedLanguage.code,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  };

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`flex max-w-[92%] gap-2.5 rounded-2xl p-3.5 text-xs shadow-pearl-sm leading-relaxed ${
          isUser
            ? 'bg-marine-600 text-white rounded-tr-sm'
            : 'glass-pearl text-slate-800 rounded-tl-sm border border-slate-200/80'
        }`}
      >
        <div className="mt-0.5 flex-shrink-0">
          {isUser ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white">
              <User className="h-3 w-3" />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-marine-100 text-marine-700">
              <Bot className="h-3 w-3" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <div className="whitespace-pre-wrap font-sans text-xs">
            {message.content}
          </div>

          {/* Assistant Footer: Read Aloud + Swarm Trace + Evidence */}
          {!isUser && (
            <div className="pt-2 border-t border-slate-200/60 mt-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                {/* Indic Text-to-Speech Playback */}
                <button
                  onClick={handleToggleSpeak}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold border transition-all ${
                    isSpeaking
                      ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title={isSpeaking ? 'Stop voice read-out' : `Listen in ${detectedLanguage.nativeName} (${detectedLanguage.name})`}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-3 w-3 text-amber-600" />
                      <span>Stop Voice</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 text-marine-600" />
                      <span>Read Aloud ({detectedLanguage.nativeName})</span>
                    </>
                  )}
                </button>

                {agent && (
                  <button
                    onClick={() => setShowEvidence((prev) => !prev)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-marine-700 hover:text-marine-800 transition-colors ml-1"
                  >
                    <Database className="h-3 w-3" />
                    <span>Evidence ({agent.evidence.sources.length})</span>
                    {showEvidence ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>

              {agent?.swarmTrace && onInspectSwarm && (
                <button
                  onClick={() => onInspectSwarm(agent.swarmTrace!)}
                  className="inline-flex items-center gap-1 rounded-lg bg-marine-50 hover:bg-marine-100 px-2 py-0.5 text-[10px] font-semibold text-marine-700 border border-marine-200 transition-all hover:scale-102"
                  title="Inspect Multi-Agent Swarm Execution Steps"
                >
                  <Activity className="h-2.5 w-2.5 text-marine-600" />
                  <span>Swarm Trace ({agent.swarmTrace.steps.length} steps)</span>
                </button>
              )}

              {/* Collapsible Evidence Payload */}
              {showEvidence && agent && (
                <div className="w-full mt-2 space-y-2 rounded-xl bg-slate-50/90 p-2.5 border border-slate-200 text-[11px] text-slate-600">
                  <div className="font-semibold text-slate-700 flex items-center justify-between">
                    <span>Authoritative Data Sources</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Tools: {agent.toolsUsed.join(', ')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {agent.evidence.sources.map((src, i) => (
                      <div key={i} className="flex flex-col gap-0.5 rounded-lg bg-white p-1.5 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">{src.name}</span>
                          <StatusBadge status={src.status} />
                        </div>
                        {src.observationTime && (
                          <div className="text-[10px] text-slate-500">
                            Observation Time: <span className="font-mono">{src.observationTime}</span>
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400">
                          Retrieved: {new Date(src.retrievedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* LLM Engine Telemetry */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-marine-600" />
                      <span>{agent.llmMetadata.provider.toUpperCase()}: {agent.llmMetadata.model}</span>
                    </div>
                    <span>{agent.llmMetadata.executionTimeMs} ms</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Suggested Follow-up Queries */}
      {agent?.suggestedQueries && agent.suggestedQueries.length > 0 && onSelectPrompt && (
        <div className="flex flex-wrap gap-1.5 max-w-[92%] pl-2 pt-0.5">
          {agent.suggestedQueries.map((query, qIdx) => (
            <button
              key={qIdx}
              onClick={() => onSelectPrompt(query)}
              className="inline-flex items-center gap-1 rounded-full bg-white/90 hover:bg-marine-50 border border-slate-200/80 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:text-marine-700 shadow-2xs transition-all hover:scale-102 active:scale-98"
            >
              <Sparkles className="h-2.5 w-2.5 text-marine-600" />
              <span>{query}</span>
            </button>
          ))}
        </div>
      )}

      <span suppressHydrationWarning className="text-[9px] text-slate-400 px-1 font-mono">
        {message.timestamp}
      </span>
    </div>
  );
}
