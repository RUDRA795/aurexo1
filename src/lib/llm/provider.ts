import { generateWithGemini } from './gemini';
import { generateWithGroq } from './groq';
import { generateWithOllama, OllamaError } from './ollama';
import { generateRuleBasedResponse } from './fallback-rules';
import { distillToolContextForLLM } from './context-distiller';
import { discoverOllamaModels } from './model-discovery';
import { detectIndicLanguage } from '../utils/indic-voice';

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
  provider: 'gemini' | 'groq' | 'ollama' | 'rule_fallback';
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

const SYSTEM_INSTRUCTION = `You are AUREXO (also operating as ORCA), an advanced ISRO-standard production maritime intelligence platform and conversational ocean copilot for the Indian Ocean, Arabian Sea, and Bay of Bengal.

CORE OPERATIONAL & CONVERSATIONAL PROTOCOLS:
1. CONVERSATIONAL ACCURACY & NATURAL PROSE:
   - Answer the user's specific question directly, clearly, and conversationally in the opening sentences.
   - DO NOT repeat static, rigid, robotic document headers like "# AUREXO Maritime Intelligence Brief" or "Platform Status: ISRO-Standard" at the start of every message.
   - Use natural, professional language suitable for mariners, port operators, navigators, and citizens.
2. NO LATEX MATH FORMATTING:
   - NEVER use LaTeX math delimiters (such as $...$, \\text{}, or \\circ).
   - Format units in clean, readable text: "30.2°C" (NOT "$30.2^\\circ\\text{C}$"), "0.56 m" (NOT "$0.56\\text{ m}$"), "8.1 km/h" (NOT "$8.1\\text{ km/h}$"), and "708.3 km" (NOT "$708.3\\text{ km}$").
3. GROUNDED IN TELEMETRY WITHOUT HALLUCINATION:
   - Base all wave heights, wind speeds, Beaufort levels, sea surface temperatures (SST), ocean currents, and boundary distances strictly on the verified data provided.
   - Never invent or alter numbers. If telemetry is not available, state so clearly.
4. INLAND / NON-COASTAL QUERIES (e.g. Delhi, Jaipur, Bengaluru):
   - If the user asks about an inland city, acknowledge that it is an inland/landlocked territory without direct coastal sea state.
   - State the approximate distance to its nearest major Indian seaports (e.g., for Delhi: Kandla, Mundra, Mumbai JNPT), and explain that AUREXO monitors India's 7,516 km coastline and maritime Exclusive Economic Zone (EEZ).
   - Never output oceanographic wave or sea state tables for an inland city.
5. GREETINGS & CAPABILITIES:
   - If the user sends a greeting (e.g., "hi", "namaste", "hello") or asks what you can do, respond warmly and provide a concise overview of how to explore waves, weather, vessels, boundaries, and PFZ on the platform.
6. MULTILINGUAL & INDIC LANGUAGE PROTOCOL:
   - If the user writes in an Indian regional language (Hindi, Tamil, Telugu, Malayalam, Bengali, Marathi, Gujarati, Kannada, Odia, Punjabi) or in phonetic Roman transliteration (Hinglish, Tanglish, etc.), respond fluently in that exact language/transliteration.
   - Maintain 100% precision for all numeric units regardless of language.
7. TACTICAL MARITIME SAFETY:
   - When discussing marine conditions, provide clear actionable directives for small craft/fishermen, commercial navigators, and coastal authorities.`;

/**
 * Sanitizes markdown by stripping any residual LaTeX math symbols and formatting anomalies
 * to ensure pristine rendering across all frontend interfaces.
 */
export function sanitizeMarkdownFormatting(text: string): string {
  if (!text) return text;
  return text
    // Replace $\text{...}$ or ${...}$
    .replace(/\$\\text\{([^}]+)\}\$/g, '$1')
    // Replace $12.3^\circ\text{C}$ or $12.3^\circ C$ with 12.3°C
    .replace(/\$(\d+(?:\.\d+)?)\^\\circ\\text\{C\}\$/g, '$1°C')
    .replace(/\$(\d+(?:\.\d+)?)\^\\circ\s*C\$/g, '$1°C')
    .replace(/\$(\d+(?:\.\d+)?)\^\\circ\$/g, '$1°')
    // Replace $12.3\text{ m}$ with 12.3 m
    .replace(/\$(\d+(?:\.\d+)?)\s*\\text\{\s*([a-zA-Z/%]+)\s*\}\$/g, '$1 $2')
    .replace(/\$(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)\$/g, '$1 $2')
    // Replace simple dollar numbers like $708.3$ with 708.3
    .replace(/\$(\d+(?:\.\d+)?)\$/g, '$1')
    // Remove isolated \text{...}
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\circ/g, '°')
    // Clean up double spaces
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function formatErrorDetail(err: unknown): string {
  if (err instanceof OllamaError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
      return '[QUOTA_EXHAUSTED_429] Rate quota reached';
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
 * Dispatches LLM inference across the ISRO production-grade fallback hierarchy:
 * 1. Gemini Cloud (Primary: gemini-2.5-flash / gemini-1.5-flash / gemini-3.5-flash-lite)
 * 2. Groq Cloud (Fast Open-Weights: Llama 3.3 70B / DeepSeek R1 if GROQ_API_KEY present)
 * 3. Dynamic Local Ollama (Discovered highest-capability active model on host/tunnel)
 * 4. Secondary Ollama (Discovered compact fallback model or configured llama3.2:1b)
 * 5. Deterministic Zero-Hallucination Rule Synthesizer with Indic transliteration awareness
 */
export async function synthesizeMarineResponse({
  userPrompt,
  intent,
  toolData,
  escalate = false,
}: SynthesizeOptions): Promise<LLMResult> {
  const contextSummary = distillToolContextForLLM(toolData);
  const detectedLang = detectIndicLanguage(userPrompt);

  const langInstruction =
    detectedLang.code !== 'en-IN'
      ? `\nUser language detected: ${detectedLang.name} (${detectedLang.code}). Respond naturally and fluently in ${detectedLang.name} while preserving all numbers and metric units.`
      : '';

  const prompt = `User Query: "${userPrompt}"
Operational Context: ${intent}
${langInstruction}

VERIFIED TOOL DATA & DOMAIN CONTEXT:
${contextSummary}

Respond directly to the user's query in a natural, conversational, professional tone. Ensure all figures are strictly grounded in the verified data without using LaTeX math symbols.`;

  // Step 1: Attempt Gemini Cloud
  try {
    const geminiModel = escalate
      ? process.env.GEMINI_ESCALATION_MODEL || 'gemini-1.5-pro'
      : process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const res = await generateWithGemini(prompt, {
      model: geminiModel,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    return {
      text: sanitizeMarkdownFormatting(res.text),
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
      `[AUREXO LLM Dispatcher] Gemini unavailable: ${formatErrorDetail(geminiError)}. Trying next tier...`
    );
  }

  // Step 2: Attempt Groq Cloud if API key is present
  if (process.env.GROQ_API_KEY) {
    try {
      const groqRes = await generateWithGroq(prompt, {
        systemInstruction: SYSTEM_INSTRUCTION,
      });
      return {
        text: sanitizeMarkdownFormatting(groqRes.text),
        provider: 'groq',
        model: groqRes.model,
        executionTimeMs: groqRes.executionTimeMs,
        escalated: false,
        metrics: {
          totalDurationMs: groqRes.executionTimeMs,
        },
      };
    } catch (groqError) {
      console.warn(
        `[AUREXO LLM Dispatcher] Groq failed: ${formatErrorDetail(groqError)}. Failing over to Ollama...`
      );
    }
  }

  // Step 3: Probe & Dispatch to Dynamic Local/Tunnel Ollama
  try {
    const discovery = await discoverOllamaModels();
    const primaryModel =
      discovery.recommendedPrimary ||
      process.env.OLLAMA_PRIMARY_MODEL ||
      'llama3.2:3b';

    if (discovery.isAvailable || process.env.OLLAMA_BASE_URL) {
      const res = await generateWithOllama(prompt, {
        model: primaryModel,
        systemInstruction: SYSTEM_INSTRUCTION,
        think: false,
        keepAlive: '10m',
      });

      return {
        text: sanitizeMarkdownFormatting(res.text),
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
    }
  } catch (ollamaPrimaryError) {
    console.warn(
      `[AUREXO LLM Dispatcher] Ollama primary failed: ${formatErrorDetail(ollamaPrimaryError)}. Trying secondary Ollama...`
    );
  }

  // Step 4: Attempt Secondary Ollama Model
  try {
    const discovery = await discoverOllamaModels();
    const fallbackModel =
      discovery.recommendedFallback ||
      process.env.OLLAMA_FALLBACK_MODEL ||
      'llama3.2:1b';

    if (discovery.isAvailable || process.env.OLLAMA_BASE_URL) {
      const res = await generateWithOllama(prompt, {
        model: fallbackModel,
        systemInstruction: SYSTEM_INSTRUCTION,
        think: false,
        keepAlive: '10m',
      });

      return {
        text: sanitizeMarkdownFormatting(res.text),
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
    }
  } catch (ollamaSecondaryError) {
    console.warn(
      `[AUREXO LLM Dispatcher] Ollama fallback failed: ${formatErrorDetail(ollamaSecondaryError)}. Cascading to deterministic rule synthesizer...`
    );
  }

  // Step 5: Guaranteed Zero-Hallucination Deterministic Rule Synthesizer
  const startTime = Date.now();
  const ruleText = generateRuleBasedResponse(intent, {
    conditions: toolData.conditions,
    geofence: toolData.geofence,
    pfz: toolData.pfz,
    route: toolData.route,
    hazards: toolData.hazards,
    vesselData: toolData.vesselData,
    regionalWarnings: toolData.regionalWarnings,
    inlandData: toolData.inlandData,
    conversational: toolData.conversational,
    conceptQuery: toolData.conceptQuery,
    safetyAssessment: toolData.safetyAssessment,
    userPrompt,
  });

  const durationMs = Date.now() - startTime;
  return {
    text: sanitizeMarkdownFormatting(ruleText),
    provider: 'rule_fallback',
    model: 'deterministic-rules-v1',
    executionTimeMs: durationMs,
    escalated: false,
    metrics: {
      totalDurationMs: durationMs,
    },
  };
}
