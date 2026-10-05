export interface GroqOptions {
  model?: string;
  timeoutMs?: number;
  systemInstruction?: string;
}

const CANDIDATE_GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'deepseek-r1-distill-llama-70b',
  'mixtral-8x7b-32768',
];

/**
 * Invokes Groq Cloud API for ultra-low-latency open-weights inference (Free Tier compatible).
 */
export async function generateWithGroq(
  prompt: string,
  options: GroqOptions = {}
): Promise<{ text: string; model: string; executionTimeMs: number }> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GROQ_API_KEY not set in environment');
  }

  const model = options.model || process.env.GROQ_MODEL || CANDIDATE_GROQ_MODELS[0];
  const timeoutMs = options.timeoutMs || 8000;
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Groq returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('Empty response from Groq');
    }

    return {
      text,
      model,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Groq request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
