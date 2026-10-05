import { NextResponse } from 'next/server';
import { discoverOllamaModels } from '@/lib/llm/model-discovery';

export async function GET() {
  const geminiConfigured = Boolean(
    process.env.DHAMMU_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);

  const discovery = await discoverOllamaModels();

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    deploymentMode: process.env.VERCEL === '1' ? 'vercel_serverless' : 'local_development',
    primaryLLM: {
      provider: 'Google Gemini',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      configured: geminiConfigured,
    },
    cloudSecondaryLLM: {
      provider: 'Groq',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      configured: groqConfigured,
    },
    localLLM: {
      provider: 'Ollama',
      status: discovery.isAvailable ? 'online' : 'offline',
      endpoint: discovery.endpoint,
      recommendedPrimary: discovery.recommendedPrimary || process.env.OLLAMA_PRIMARY_MODEL || 'llama3.2:3b',
      recommendedFallback: discovery.recommendedFallback || process.env.OLLAMA_FALLBACK_MODEL || 'llama3.2:1b',
      availableModels: discovery.models.map((m) => m.name),
      latencyMs: discovery.latencyMs,
    },
    deterministicFallback: {
      status: 'online',
      engine: 'Turf.js + AUREXO Rules v1',
    },
    verifiedDataSources: [
      'Open-Meteo Marine API (Waves, Currents, Swell, SST)',
      'Open-Meteo Weather API (Wind, Gusts, Pressure, Precipitation)',
      'NASA GIBS WMS / WMTS (MODIS TrueColor, GHRSST SST, MODIS Chl-A)',
      'Hydrographic Maritime Boundary Sentinel (IMBL / EEZ / MPA polygons)',
    ],
  });
}
