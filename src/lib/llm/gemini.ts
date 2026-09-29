import { GoogleGenAI } from '@google/genai';

interface GeminiOptions {
  model?: string;
  timeoutMs?: number;
  systemInstruction?: string;
}

/**
 * Invokes Gemini Flash (primary: gemini-3.8-flash) with explicit timeout protection.
 * Resolves API key securely from server-only environment variables.
 */
export async function generateWithGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<{ text: string; model: string; executionTimeMs: number }> {
  const apiKey = process.env.DHAMMU_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key not found in server environment');
  }

  const model = options.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const timeoutMs = options.timeoutMs || parseInt(process.env.GEMINI_TIMEOUT_MS || '12000', 10);

  const startTime = Date.now();

  const ai = new GoogleGenAI({ apiKey });

  // Use Promise.race with strict timeout so a slow response never blocks execution
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const generatePromise = (async () => {
    const config: Record<string, unknown> = {
      temperature: 0.2, // Low temperature for high factual accuracy
      maxOutputTokens: 1024,
    };

    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const text = response.text ?? '';
    if (!text) {
      throw new Error('Empty response received from Gemini');
    }
    return text;
  })();

  const text = await Promise.race([generatePromise, timeoutPromise]);
  const executionTimeMs = Date.now() - startTime;

  return {
    text,
    model,
    executionTimeMs,
  };
}
