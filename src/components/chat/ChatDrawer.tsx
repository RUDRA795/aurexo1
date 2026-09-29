'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronLeft, ChevronRight, MessageSquare, Loader2, Sparkles, Activity } from 'lucide-react';
import { AgentResponse, GeoCoordinate, SessionContext } from '@/lib/types/domain';
import { AgentSwarmTrace } from '@/lib/types/agents';
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
}

export function ChatDrawer({ onAgentResponse, selectedCoordinate, onInspectSwarm, className }: ChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext>({});
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to **Aurexo** // Autonomous Marine Intelligence Platform.\n\nI can assist you with:\n• Verified real-time wave, wind, and sea conditions\n• Satellite observation layers (SST, Chlorophyll, TrueColor)\n• Potential Fishing Zones (PFZ) & Habitat Suitability\n• Border proximity (IMBL) & Marine Protected Area compliance\n• Real-time Indian vessel & fleet tracking\n• Sector-level regional marine warnings\n\nClick anywhere on the map or ask a tactical inquiry below.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

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
        isOpen ? 'w-[380px] sm:w-[420px]' : 'w-12'
      } ${className ?? ''}`}
    >
      {/* Drawer Body */}
      {isOpen ? (
        <div className="glass-pearl flex h-[calc(100vh-6rem)] w-full flex-col rounded-2xl shadow-pearl-lg overflow-hidden border border-slate-200/80">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 bg-white/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-marine-600" />
              <span className="text-xs font-bold text-slate-800">Aurexo Multi-Agent Copilot</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Collapse drawer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
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

          {/* Input Box */}
          <div className="border-t border-slate-200/80 p-3 bg-white/70">
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
                placeholder="Ask about sea conditions, vessels, regions, SST..."
                disabled={isLoading}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-marine-500/20 focus:border-marine-500 shadow-pearl-sm"
              />
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
          title="Open Aurexo Chat Drawer"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
