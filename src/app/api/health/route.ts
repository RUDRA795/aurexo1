import { NextResponse } from 'next/server';

export async function GET() {
  const geminiConfigured = Boolean(process.env.DHAMMU_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

  let ollamaStatus = 'offline';
  let availableOllamaModels: string[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      availableOllamaModels = (data.models || []).map((m: any) => m.name);
      ollamaStatus = 'online';
    }
  } catch {
    ollamaStatus = 'offline';
  }

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    primaryLLM: {
      provider: 'Google Gemini',
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      configured: geminiConfigured,
    },
    localLLM: {
      provider: 'Ollama',
      status: ollamaStatus,
      primaryModel: process.env.OLLAMA_PRIMARY_MODEL || 'qwen3.5:4b',
      availableModels: availableOllamaModels,
    },
    verifiedDataSources: [
      'Open-Meteo Marine API',
      'Open-Meteo Weather API',
      'NASA GIBS WMS / WMTS (MODIS TrueColor, GHRSST SST, Chlorophyll-A)',
    ],
  });
}
