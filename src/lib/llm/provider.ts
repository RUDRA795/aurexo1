import { generateWithGemini } from './gemini';
import { generateWithOllama } from './ollama';
import { generateRuleBasedResponse } from './fallback-rules';

export interface LLMResult {
  text: string;
  provider: 'gemini' | 'ollama' | 'rule_fallback';
  model: string;
  executionTimeMs: number;
  escalated: boolean;
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

/**
 * Dispatches LLM inference across the prioritized fallback hierarchy:
 * 1. Gemini 3.8 Flash (Primary)
 * 2. Ollama qwen3.5:4b (Local Primary Fallback)
 * 3. Ollama llama3.2:1b (Local Secondary Fallback)
 * 4. Deterministic Rule Synthesizer (Guaranteed Fallback)
 */
export async function synthesizeMarineResponse({
  userPrompt,
  intent,
  toolData,
  escalate = false,
}: SynthesizeOptions): Promise<LLMResult> {
  const contextPayload = JSON.stringify(toolData, null, 2);
  const prompt = `User Request: "${userPrompt}"
Identified Intent: ${intent}

VERIFIED TOOL DATA & SENSOR MEASUREMENTS:
${contextPayload}

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
    };
  } catch (geminiError) {
    console.warn('[Aurexo LLM Dispatcher] Gemini unavailable or timed out, trying Ollama qwen3.5:4b...', geminiError);
  }

  // Step 2: Attempt Local Ollama (qwen3.5:4b)
  try {
    const primaryOllamaModel = process.env.OLLAMA_PRIMARY_MODEL || 'qwen3.5:4b';
    const res = await generateWithOllama(prompt, {
      model: primaryOllamaModel,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
    return {
      text: res.text,
      provider: 'ollama',
      model: res.model,
      executionTimeMs: res.executionTimeMs,
      escalated: false,
    };
  } catch (qwenError) {
    console.warn('[Aurexo LLM Dispatcher] Ollama qwen3.5:4b failed, trying llama3.2:1b...', qwenError);
  }

  // Step 3: Attempt Local Ollama Secondary (llama3.2:1b)
  try {
    const fallbackOllamaModel = process.env.OLLAMA_FALLBACK_MODEL || 'llama3.2:1b';
    const res = await generateWithOllama(prompt, {
      model: fallbackOllamaModel,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
    return {
      text: res.text,
      provider: 'ollama',
      model: res.model,
      executionTimeMs: res.executionTimeMs,
      escalated: false,
    };
  } catch (llamaError) {
    console.warn('[Aurexo LLM Dispatcher] Ollama llama3.2:1b failed, falling back to rule synthesizer...', llamaError);
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

  return {
    text: ruleText,
    provider: 'rule_fallback',
    model: 'deterministic-rules-v1',
    executionTimeMs: Date.now() - startTime,
    escalated: false,
  };
}
