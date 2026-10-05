export interface OmniRouteOptions {
  model?: string;
  timeoutMs?: number;
  systemInstruction?: string;
}

/**
 * Invokes OmniRoute (OpenAI-compatible gateway via Cloudflare Tunnel or local proxy).
 */
export async function generateWithOmniRoute(
  prompt: string,
  options: OmniRouteOptions = {}
): Promise<{ text: string; model: string; executionTimeMs: number }> {
  const apiKey = process.env.OMNIROUTE_API_KEY;
  const baseUrl =
    process.env.OMNIROUTE_BASE_URL ||
    process.env.OMNIROUTE_LOCAL_URL ||
    'http://localhost:20128/v1';

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('OMNIROUTE_API_KEY not configured in environment');
  }

  const model = options.model || process.env.OMNIROUTE_MODEL || 'default';
  const timeoutMs = options.timeoutMs || Number(process.env.OMNIROUTE_TIMEOUT_MS) || 12000;
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = `${cleanBaseUrl}/chat/completions`;

  try {
    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(endpoint, {
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
      throw new Error(`OmniRoute returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('Empty response from OmniRoute');
    }

    return {
      text,
      model: data?.model || model,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`OmniRoute request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
