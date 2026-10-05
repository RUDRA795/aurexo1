'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  ChevronLeft,
  Loader2,
  Sparkles,
  Mic,
  MicOff,
  Globe,
  Languages,
} from 'lucide-react';
import { AgentResponse, GeoCoordinate, SessionContext } from '@/lib/types/domain';
import { AgentSwarmTrace } from '@/lib/types/agents';
import { INDIC_LANGUAGES, IndicLanguage } from '@/lib/utils/indic-voice';
import { ChatMessage } from './ChatMessage';
import { QuickPrompts } from './QuickPrompts';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentData?: AgentResponse;
  timestamp: string;
}

interface ChatDrawerProps {
  onAgentResponse?: (res: AgentResponse) => void;
  selectedCoordinate?: GeoCoordinate | null;
  onInspectSwarm?: (trace: AgentSwarmTrace) => void;
  className?: string;
  externalPromptTrigger?: { prompt: string; timestamp: number } | null;
}

export function ChatDrawer({
  onAgentResponse,
  selectedCoordinate,
  onInspectSwarm,
  className,
  externalPromptTrigger,
}: ChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext>({});
  const [selectedLang, setSelectedLang] = useState<IndicLanguage>(INDIC_LANGUAGES[0]);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to **ORCA** // Collaborative Marine Intelligence Platform.\n\nI can assist you with:\n• Verified real-time wave, wind, and sea conditions\n• Satellite observation layers (SST, Chlorophyll, TrueColor)\n• Potential Fishing Zones (PFZ) & Habitat Suitability\n• Border proximity (IMBL) & Marine Protected Area compliance\n• Real-time Indian vessel & fleet tracking\n• Sector-level regional marine warnings\n\nClick anywhere on the map or ask a tactical inquiry below in any Indian language.',
      timestamp: 'Tactical AI',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedTriggerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Set client-local time for welcome message on mount without SSR mismatch
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'welcome' && m.timestamp === 'Tactical AI'
          ? {
              ...m,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : m
      )
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle external prompt triggers (e.g. from map point intelligence "Ask ORCA" button)
  useEffect(() => {
    if (
      externalPromptTrigger?.prompt &&
      externalPromptTrigger.timestamp !== lastProcessedTriggerRef.current
    ) {
      lastProcessedTriggerRef.current = externalPromptTrigger.timestamp;
      setIsOpen(true);
      handleSubmit(externalPromptTrigger.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPromptTrigger]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = selectedLang.code;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition notice:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Could not start speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleSubmit = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history (excluding the welcome message)
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          coordinate: selectedCoordinate ?? undefined,
          conversationHistory: history,
          sessionContext: sessionContext,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const agentData: AgentResponse = await res.json();

      // Update multi-turn session context (location memory, coordinates, last active layer)
      if (agentData.sessionContext) {
        setSessionContext((prev) => ({
          ...prev,
          ...agentData.sessionContext,
        }));
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: agentData.answer,
        agentData,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (onAgentResponse) {
        onAgentResponse(agentData);
      }
    } catch (error) {
      console.error('Agent query error:', error);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          '⚠️ Notice: Unable to complete the request through the primary reasoning cluster. Please check that the server is online or retry your query.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`relative z-20 flex transition-all duration-300 ${
        isOpen ? 'w-[380px] sm:w-[430px]' : 'w-12'
      } ${className ?? ''}`}
    >
      {/* Drawer Body */}
      {isOpen ? (
        <div className="glass-pearl flex h-[calc(100vh-11rem)] sm:h-[calc(100vh-11.5rem)] max-h-[740px] w-full flex-col rounded-2xl shadow-pearl-lg overflow-hidden border border-slate-200/80">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2.5 bg-white/60">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 overflow-hidden rounded-full border border-cyan-500/40">
                <img src="/images/orca-logo-circle.png" alt="ORCA" className="h-full w-full object-cover" />
              </div>
              <span className="text-xs font-bold text-slate-800">ORCA Multi-Agent Copilot</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Indic Language Picker Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangMenu((p) => !p)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Select Indic Voice & Conversation Language"
                >
                  <Globe className="h-3 w-3 text-marine-600" />
                  <span>{selectedLang.nativeName}</span>
                </button>

                {showLangMenu && (
                  <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Indic Languages
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {INDIC_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLang(lang);
                            setShowLangMenu(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                            selectedLang.code === lang.code
                              ? 'bg-marine-50 text-marine-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{lang.nativeName} ({lang.name.split(' ')[0]})</span>
                          <span className="text-[10px] text-slate-400 font-mono">{lang.code.split('-')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Collapse drawer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                onSelectPrompt={(p) => handleSubmit(p)}
                onInspectSwarm={onInspectSwarm}
              />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 rounded-2xl glass-pearl p-3 text-xs text-marine-700 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-marine-600" />
                <span>Orchestrating multi-agent swarm & marine reasoning...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Dock */}
          <div className="border-t border-slate-200/60 p-2.5 bg-slate-50/50">
            <QuickPrompts onSelectPrompt={(p) => handleSubmit(p)} disabled={isLoading} />
          </div>

          {/* Input Box with Voice Capture */}
          <div className="border-t border-slate-200/80 p-3 bg-white/70">
            {isListening && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-rose-50 px-2.5 py-1.5 border border-rose-200 text-xs text-rose-700 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Listening in <b>{selectedLang.nativeName} ({selectedLang.name})</b>... Speak now</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="text-[10px] font-semibold text-rose-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedLang.code === 'hi-IN'
                    ? 'समुद्र की स्थिति, जहाजों या मछली पकड़ने के क्षेत्र के बारे में पूछें...'
                    : selectedLang.code === 'ta-IN'
                    ? 'கடல் நிலை, படகுகள் அல்லது மீன்பிடி மண்டலங்கள் பற்றி கேட்கவும்...'
                    : selectedLang.code === 'te-IN'
                    ? 'సముద్ర పరిస్థితులు లేదా చేపల వేట ప్రాంతాల గురించి అడగండి...'
                    : 'Ask about sea conditions, vessels, regions, SST, PFZ...'
                }
                disabled={isLoading}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-marine-500/20 focus:border-marine-500 shadow-pearl-sm"
              />

              {/* Mic Speech Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isLoading}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 flex-shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title={isListening ? 'Stop listening' : `Voice input in ${selectedLang.nativeName}`}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-marine-600 text-white shadow-sm hover:bg-marine-700 disabled:opacity-40 transition-all active:scale-95 flex-shrink-0"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Pill */
        <button
          onClick={() => setIsOpen(true)}
          className="glass-pearl flex h-12 w-12 items-center justify-center rounded-2xl shadow-pearl-md text-marine-600 hover:text-marine-800 transition-all hover:scale-105 active:scale-95"
          title="Open ORCA Chat Drawer"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
