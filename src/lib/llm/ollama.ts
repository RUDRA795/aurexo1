export type OllamaErrorCode =
  | 'TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'MODEL_NOT_FOUND'
  | 'MALFORMED_RESPONSE'
  | 'SERVER_ERROR';

export class OllamaError extends Error {
  readonly code: OllamaErrorCode;
  readonly model: string;
  readonly statusCode?: number;

  constructor(message: string, code: OllamaErrorCode, model: string, statusCode?: number) {
    super(message);
    this.name = 'OllamaError';
    this.code = code;
    this.model = model;
    this.statusCode = statusCode;
  }
}

export interface OllamaOptions {
  model?: string;
  timeoutMs?: number;
  contextWindow?: number;
  numPredict?: number;
  systemInstruction?: string;
  think?: boolean;
  keepAlive?: string;
  temperature?: number;
}

export interface OllamaResponse {
  text: string;
  model: string;
  executionTimeMs: number;
  totalDurationMs?: number;
  loadDurationMs?: number;
  promptEvalCount?: number;
  promptEvalDurationMs?: number;
  evalCount?: number;
  evalDurationMs?: number;
  rawDurationNs?: {
    totalDuration?: number;
    loadDuration?: number;
    promptEvalDuration?: number;
    evalDuration?: number;
  };
}

/**
 * Invokes local Ollama inference with strict error categorization and configurable timeout.
 * Defaults to 90,000ms timeout for local inference.
 * Explicitly sets think: false, keep_alive: '10m', contextWindow, and numPredict.
 */
export async function generateWithOllama(
  prompt: string,
  options: OllamaOptions = {}
): Promise<OllamaResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = options.model || process.env.OLLAMA_PRIMARY_MODEL || 'llama3.2:3b';
  const timeoutMs =
    options.timeoutMs ??
    parseInt(process.env.OLLAMA_TIMEOUT_MS || '90000', 10);
  const contextWindow =
    options.contextWindow ??
    parseInt(process.env.OLLAMA_CONTEXT_WINDOW || '2048', 10);
  const numPredict =
    options.numPredict ??
    parseInt(process.env.OLLAMA_NUM_PREDICT || '384', 10);
  const think = options.think ?? false;
  const keepAlive = options.keepAlive ?? (process.env.OLLAMA_KEEP_ALIVE || '10m');
  const temperature = options.temperature ?? 0.2;

  const requestStartTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt,
          system: options.systemInstruction,
          stream: false,
          think,
          keep_alive: keepAlive,
          options: {
            temperature,
            num_ctx: contextWindow,
            num_predict: numPredict,
          },
        }),
      });
    } catch (networkError) {
      if (networkError instanceof Error && networkError.name === 'AbortError') {
        throw new OllamaError(
          `Ollama (${model}) request timed out after ${timeoutMs}ms`,
          'TIMEOUT',
          model
        );
      }
      const isConnRefused =
        networkError instanceof Error &&
        (networkError.message.includes('ECONNREFUSED') ||
          networkError.message.includes('fetch failed'));
      throw new OllamaError(
        `Ollama (${model}) connection failed: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
        isConnRefused ? 'CONNECTION_REFUSED' : 'SERVER_ERROR',
        model
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new OllamaError(
          `Ollama model "${model}" not found (HTTP 404)`,
          'MODEL_NOT_FOUND',
          model,
          404
        );
      }
      throw new OllamaError(
        `Ollama returned HTTP ${res.status}: ${res.statusText}`,
        'SERVER_ERROR',
        model,
        res.status
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch (jsonErr) {
      throw new OllamaError(
        `Ollama (${model}) returned malformed non-JSON payload`,
        'MALFORMED_RESPONSE',
        model
      );
    }

    const responseReceivedTime = Date.now();
    const text = typeof data.response === 'string' ? data.response.trim() : '';

    if (!text && !data.thinking) {
      throw new OllamaError(
        `Ollama model "${model}" returned empty response text`,
        'MALFORMED_RESPONSE',
        model
      );
    }

    const totalLatencyMs = responseReceivedTime - requestStartTime;
    const totalDurationMs =
      typeof data.total_duration === 'number'
        ? Math.round(data.total_duration / 1e6)
        : totalLatencyMs;
    const loadDurationMs =
      typeof data.load_duration === 'number'
        ? Math.round(data.load_duration / 1e6)
        : undefined;
    const promptEvalDurationMs =
      typeof data.prompt_eval_duration === 'number'
        ? Math.round(data.prompt_eval_duration / 1e6)
        : undefined;
    const evalDurationMs =
      typeof data.eval_duration === 'number'
        ? Math.round(data.eval_duration / 1e6)
        : undefined;

    return {
      text,
      model: data.model || model,
      executionTimeMs: totalLatencyMs,
      totalDurationMs,
      loadDurationMs,
      promptEvalCount: data.prompt_eval_count,
      promptEvalDurationMs,
      evalCount: data.eval_count,
      evalDurationMs,
      rawDurationNs: {
        totalDuration: data.total_duration,
        loadDuration: data.load_duration,
        promptEvalDuration: data.prompt_eval_duration,
        evalDuration: data.eval_duration,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof OllamaError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OllamaError(
        `Ollama (${model}) request timed out after ${timeoutMs}ms`,
        'TIMEOUT',
        model
      );
    }
    throw new OllamaError(
      `Ollama unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      'SERVER_ERROR',
      model
    );
  }
}
