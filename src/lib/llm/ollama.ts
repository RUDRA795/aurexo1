interface OllamaOptions {
  model?: string;
  timeoutMs?: number;
  systemInstruction?: string;
}

/**
 * Invokes local Ollama inference with strict timeout protection.
 * Supported local models: qwen3.5:4b (primary local), llama3.2:1b (secondary local).
 */
export async function generateWithOllama(
  prompt: string,
  options: OllamaOptions = {}
): Promise<{ text: string; model: string; executionTimeMs: number }> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = options.model || process.env.OLLAMA_PRIMARY_MODEL || 'qwen3.5:4b';
  const timeoutMs = options.timeoutMs || parseInt(process.env.OLLAMA_TIMEOUT_MS || '15000', 10);

  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        system: options.systemInstruction,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 512,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.response?.trim();

    if (!text) {
      throw new Error(`Ollama model ${model} returned empty response`);
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      text,
      model,
      executionTimeMs,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama (${model}) request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
