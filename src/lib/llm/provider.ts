import { generateWithGemini } from './gemini';
import { generateWithOllama, OllamaError } from './ollama';
import { generateRuleBasedResponse } from './fallback-rules';
import { distillToolContextForLLM } from './context-distiller';

export interface LLMLatencyMetrics {
  totalDurationMs: number;
  loadDurationMs?: number;
  promptEvalCount?: number;
  promptEvalDurationMs?: number;
  evalDurationMs?: number;
  evalCount?: number;
}

export interface LLMResult {
  text: string;
  provider: 'gemini' | 'ollama' | 'rule_fallback';
  model: string;
  executionTimeMs: number;
  escalated: boolean;
  metrics?: LLMLatencyMetrics;
}

export interface SynthesizeOptions {
  userPrompt: string;
  intent: string;
  toolData: Record<string, any>;
  escalate?: boolean;
}

const SYSTEM_INSTRUCTION = `You are AUREXO, an expert marine intelligence assistant for the Indian coast and maritime domain.
CORE RULES:
1. Ground your answers strictly in the verified observation data provided in the prompt.
2. NEVER invent, hallucinate, or alter any wave heights, temperatures, wind speeds, or coordinates.
3. Use precise satellite terminology: "satellite imagery", "satellite observation", "satellite-derived layer", and "retrieved observation time".
4. If an observation or data source is marked DOCUMENTED_UNVERIFIED or UNAVAILABLE, explicitly mention this to the user.
5. Provide actionable, practical safety advice for fishermen, navigators, and maritime operators.
6. Keep answers concise, clear, and professional. Use markdown formatting with bullet points.`;

function formatErrorDetail(err: unknown): string {
  if (err instanceof OllamaError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
      return '[QUOTA_EXHAUSTED_429] Gemini API rate quota reached';
    }
    if (err.name === 'AbortError' || err.message.includes('timeout') || err.message.includes('timed out')) {
      return '[TIMEOUT] Request exceeded deadline';
    }
    if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
      return '[CONNECTION_REFUSED] Service endpoint unreachable';
    }
    return `[ERROR] ${err.message}`;
  }
  return String(err);
}

/**
 * Dispatches LLM inference across the prioritized fallback hierarchy:
 * 1. Gemini 3.8 Flash (Primary)
 * 2. Ollama qwen3.5:4b (Local Primary Fallback, 90s timeout, think: false)
 * 3. Ollama llama3.2:1b (Local Secondary Fallback)
 * 4. Deterministic Rule Synthesizer (Guaranteed Safe Fallback)
 */
export async function synthesizeMarineResponse({
  userPrompt,
  intent,
  toolData,
  escalate = false,
}: SynthesizeOptions): Promise<LLMResult> {
  const contextSummary = distillToolContextForLLM(toolData);
  const prompt = `User Request: "${userPrompt}"
Identified Intent: ${intent}

VERIFIED TOOL DATA & SENSOR MEASUREMENTS:
${contextSummary}

Explain this verified data clearly to the user, highlighting safety conditions, boundary proximity, and actionable tactical recommendations according to your instructions.`;

  // Step 1: Attempt Gemini 3.8 Flash (or escalated model if requested)
  const geminiModel = escalate
    ? process.env.GEMINI_ESCALATION_MODEL || 'gemini-3.8-pro'
    : process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  try {
    const res = await generateWithGemini(prompt, {
      model: geminiModel,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
    return {
      text: res.text,
      provider: 'gemini',
      model: res.model,
      executionTimeMs: res.executionTimeMs,
      escalated: escalate,
      metrics: {
        totalDurationMs: res.executionTimeMs,
      },
    };
  } catch (geminiError) {
    console.warn(
      `[Aurexo LLM Dispatcher] Gemini unavailable: ${formatErrorDetail(geminiError)}. Failing over to local Ollama (${process.env.OLLAMA_PRIMARY_MODEL || 'llama3.2:3b'})...`
    );
  }

  // Step 2: Attempt Local Ollama (llama3.2:3b) with think: false and 90s timeout
  try {
    const primaryOllamaModel = process.env.OLLAMA_PRIMARY_MODEL || 'llama3.2:3b';
    const res = await generateWithOllama(prompt, {
      model: primaryOllamaModel,
      systemInstruction: SYSTEM_INSTRUCTION,
      think: false,
      keepAlive: '10m',
    });
    return {
      text: res.text,
      provider: 'ollama',
      model: res.model,
      executionTimeMs: res.executionTimeMs,
      escalated: false,
      metrics: {
        totalDurationMs: res.totalDurationMs ?? res.executionTimeMs,
        loadDurationMs: res.loadDurationMs,
        promptEvalCount: res.promptEvalCount,
        promptEvalDurationMs: res.promptEvalDurationMs,
        evalDurationMs: res.evalDurationMs,
        evalCount: res.evalCount,
      },
    };
  } catch (qwenError) {
    console.warn(
      `[Aurexo LLM Dispatcher] Ollama ${process.env.OLLAMA_PRIMARY_MODEL || 'qwen3.5:4b'} failed: ${formatErrorDetail(qwenError)}. Trying secondary Ollama (${process.env.OLLAMA_FALLBACK_MODEL || 'llama3.2:1b'})...`
    );
  }

  // Step 3: Attempt Local Ollama Secondary (llama3.2:1b)
  try {
    const fallbackOllamaModel = process.env.OLLAMA_FALLBACK_MODEL || 'llama3.2:1b';
    const res = await generateWithOllama(prompt, {
      model: fallbackOllamaModel,
      systemInstruction: SYSTEM_INSTRUCTION,
      think: false,
      keepAlive: '10m',
    });
    return {
      text: res.text,
      provider: 'ollama',
      model: res.model,
      executionTimeMs: res.executionTimeMs,
      escalated: false,
      metrics: {
        totalDurationMs: res.totalDurationMs ?? res.executionTimeMs,
        loadDurationMs: res.loadDurationMs,
        promptEvalCount: res.promptEvalCount,
        promptEvalDurationMs: res.promptEvalDurationMs,
        evalDurationMs: res.evalDurationMs,
        evalCount: res.evalCount,
      },
    };
  } catch (llamaError) {
    console.warn(
      `[Aurexo LLM Dispatcher] Ollama ${process.env.OLLAMA_FALLBACK_MODEL || 'llama3.2:1b'} failed: ${formatErrorDetail(llamaError)}. Cascading to deterministic rule synthesizer...`
    );
  }

  // Step 4: Deterministic Rule-Based Fallback
  const startTime = Date.now();
  const ruleText = generateRuleBasedResponse(intent, {
    conditions: toolData.conditions,
    geofence: toolData.geofence,
    pfz: toolData.pfz,
    route: toolData.route,
    hazards: toolData.hazards,
  });

  const durationMs = Date.now() - startTime;
  return {
    text: ruleText,
    provider: 'rule_fallback',
    model: 'deterministic-rules-v1',
    executionTimeMs: durationMs,
    escalated: false,
    metrics: {
      totalDurationMs: durationMs,
    },
  };
}
