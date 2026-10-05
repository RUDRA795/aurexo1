import { NextResponse } from 'next/server';
import { discoverOllamaModels } from '@/lib/llm/model-discovery';

export async function GET() {
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined;
    const ollamaDiscovery = await discoverOllamaModels();

    const geminiConfigured = Boolean(
      process.env.DHAMMU_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY
    );

    const groqConfigured = Boolean(process.env.GROQ_API_KEY);

    const providers = [
      {
        id: 'gemini',
        name: 'Google Gemini Flash',
        active: geminiConfigured,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        type: 'cloud',
        tier: 'primary',
      },
      {
        id: 'groq',
        name: 'Groq Cloud Inference',
        active: groqConfigured,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        type: 'cloud',
        tier: 'secondary',
      },
      {
        id: 'ollama',
        name: 'Ollama Local / Remote Compute',
        active: ollamaDiscovery.isAvailable,
        endpoint: ollamaDiscovery.endpoint,
        models: ollamaDiscovery.models,
        recommendedPrimary: ollamaDiscovery.recommendedPrimary,
        recommendedFallback: ollamaDiscovery.recommendedFallback,
        type: isVercel ? 'hybrid_tunnel' : 'local',
        tier: 'local_fallback',
        latencyMs: ollamaDiscovery.latencyMs,
      },
      {
        id: 'rule_fallback',
        name: 'Deterministic Turf.js & Rules Engine',
        active: true,
        model: 'deterministic-rules-v1',
        type: 'in-memory',
        tier: 'guaranteed_zero_failure',
      },
    ];

    return NextResponse.json({
      status: 'healthy',
      deploymentMode: isVercel ? 'vercel_serverless' : 'local_development',
      providers,
      recommendedActiveModel:
        geminiConfigured
          ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash')
          : (ollamaDiscovery.recommendedPrimary || 'deterministic-rules-v1'),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
