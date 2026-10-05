import { GoogleGenAI } from '@google/genai';

interface GeminiOptions {
  model?: string;
  timeoutMs?: number;
  systemInstruction?: string;
}

// Ordered list of candidate Gemini models to try in case of model availability or quota limits
const CANDIDATE_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-3.5-flash-lite',
  'gemini-1.5-pro',
];

/**
 * Invokes Gemini with adaptive multi-model fallback and strict timeout protection.
 * Resolves API key securely from server-only environment variables.
 */
export async function generateWithGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<{ text: string; model: string; executionTimeMs: number }> {
  const apiKey =
    process.env.DHAMMU_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Gemini API key not found in server environment');
  }

  const userSelectedModel = options.model || process.env.GEMINI_MODEL;
  const modelsToTry = [
    ...(userSelectedModel ? [userSelectedModel] : []),
    ...CANDIDATE_GEMINI_MODELS.filter((m) => m !== userSelectedModel),
  ];

  const timeoutMs = options.timeoutMs || parseInt(process.env.GEMINI_TIMEOUT_MS || '12000', 10);
  const startTime = Date.now();
  const ai = new GoogleGenAI({ apiKey });

  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Gemini (${model}) request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const generatePromise = (async () => {
        const config: Record<string, unknown> = {
          temperature: 0.2,
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
        if (!text || text.trim().length === 0) {
          throw new Error(`Empty response received from Gemini (${model})`);
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
    } catch (err) {
      lastError = err;
      // If error is non-fatal model error (e.g. 404 model not found or 429 quota), try next model
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('not found') ||
        errMsg.includes('404') ||
        errMsg.includes('is not supported') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('429')
      ) {
        continue;
      }
      // If it's an auth error or complete failure, break out to failover to local/deterministic
      break;
    }
  }

  throw lastError || new Error('All candidate Gemini models failed');
}
