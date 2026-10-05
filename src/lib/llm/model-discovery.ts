export interface DiscoveredModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
  category: 'reasoning' | 'general' | 'compact' | 'vision' | 'unknown';
  priorityScore: number;
}

export interface OllamaDiscoveryResult {
  isAvailable: boolean;
  endpoint: string;
  models: DiscoveredModel[];
  recommendedPrimary?: string;
  recommendedFallback?: string;
  lastChecked: string;
  latencyMs?: number;
}

let cachedDiscovery: OllamaDiscoveryResult | null = null;
let lastDiscoveryTimestamp = 0;
const DISCOVERY_CACHE_TTL_MS = 15000; // 15 seconds cache

/**
 * Classifies model based on its tag name and assigns a priority score.
 * Higher priority score = better candidate for primary reasoning.
 */
function evaluateModelPriority(modelName: string): { category: DiscoveredModel['category']; priorityScore: number } {
  const name = modelName.toLowerCase();

  // Reasoning-specific models (Highest priority)
  if (name.includes('deepseek-r1') || name.includes('r1') || name.includes('qwq')) {
    const score = name.includes('70b') || name.includes('32b') ? 95 : name.includes('14b') || name.includes('8b') || name.includes('7b') ? 90 : 85;
    return { category: 'reasoning', priorityScore: score };
  }

  // High capability modern open models
  if (name.includes('qwen2.5') || name.includes('qwen3.5') || name.includes('qwen')) {
    const score = name.includes('72b') || name.includes('32b') ? 92 : name.includes('14b') || name.includes('7b') ? 88 : name.includes('3b') || name.includes('4b') ? 80 : 70;
    return { category: 'general', priorityScore: score };
  }

  if (name.includes('llama3.3') || name.includes('llama3.1') || name.includes('llama3')) {
    const score = name.includes('70b') ? 91 : name.includes('8b') ? 86 : name.includes('3b') ? 78 : name.includes('1b') ? 65 : 75;
    return { category: 'general', priorityScore: score };
  }

  if (name.includes('mistral') || name.includes('mixtral') || name.includes('nemo')) {
    return { category: 'general', priorityScore: 82 };
  }

  if (name.includes('gemma2') || name.includes('gemma')) {
    const score = name.includes('27b') ? 87 : name.includes('9b') ? 84 : 72;
    return { category: 'general', priorityScore: score };
  }

  if (name.includes('phi4') || name.includes('phi3')) {
    return { category: 'compact', priorityScore: 76 };
  }

  // Small/Fast models for fallback
  if (name.includes('1b') || name.includes('0.5b') || name.includes('tiny')) {
    return { category: 'compact', priorityScore: 60 };
  }

  return { category: 'unknown', priorityScore: 50 };
}

/**
 * Probes the Ollama server to discover all locally installed and active models.
 * Operates non-blockingly with a fast timeout (1500ms).
 */
export async function discoverOllamaModels(customEndpoint?: string): Promise<OllamaDiscoveryResult> {
  const now = Date.now();
  if (cachedDiscovery && now - lastDiscoveryTimestamp < DISCOVERY_CACHE_TTL_MS) {
    return cachedDiscovery;
  }

  // Check if running in Vercel Cloud Serverless environment
  const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined;

  // Choose endpoint: Custom -> Tunnel -> Env Var -> Localhost
  const endpoint =
    customEndpoint ||
    process.env.OLLAMA_TUNNEL_URL ||
    process.env.REMOTE_OLLAMA_URL ||
    process.env.OLLAMA_BASE_URL ||
    'http://127.0.0.1:11434';

  // If on Vercel and endpoint is localhost, skip local probe to avoid serverless timeout delays
  if (isVercel && (endpoint.includes('127.0.0.1') || endpoint.includes('localhost'))) {
    const vercelResult: OllamaDiscoveryResult = {
      isAvailable: false,
      endpoint,
      models: [],
      lastChecked: new Date().toISOString(),
    };
    cachedDiscovery = vercelResult;
    lastDiscoveryTimestamp = now;
    return vercelResult;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const failedResult: OllamaDiscoveryResult = {
        isAvailable: false,
        endpoint,
        models: [],
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
      cachedDiscovery = failedResult;
      lastDiscoveryTimestamp = now;
      return failedResult;
    }

    const json = await res.json();
    const rawModels: any[] = Array.isArray(json?.models) ? json.models : [];

    const discovered: DiscoveredModel[] = rawModels.map((m) => {
      const name = m.name || m.model || 'unknown';
      const { category, priorityScore } = evaluateModelPriority(name);
      return {
        name,
        size: m.size || 0,
        digest: m.digest || '',
        modifiedAt: m.modified_at || '',
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
        quantizationLevel: m.details?.quantization_level,
        category,
        priorityScore,
      };
    });

    // Sort models by priority score descending
    discovered.sort((a, b) => b.priorityScore - a.priorityScore);

    // Pick best primary and fallback
    const primary = discovered[0]?.name;
    const fallback = discovered.find((m) => m.name !== primary && m.priorityScore >= 60)?.name || discovered[1]?.name;

    const result: OllamaDiscoveryResult = {
      isAvailable: discovered.length > 0,
      endpoint,
      models: discovered,
      recommendedPrimary: primary,
      recommendedFallback: fallback,
      lastChecked: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };

    cachedDiscovery = result;
    lastDiscoveryTimestamp = now;
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    const errResult: OllamaDiscoveryResult = {
      isAvailable: false,
      endpoint,
      models: [],
      lastChecked: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
    cachedDiscovery = errResult;
    lastDiscoveryTimestamp = now;
    return errResult;
  }
}
