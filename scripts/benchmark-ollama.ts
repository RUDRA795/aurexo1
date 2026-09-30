import { generateWithOllama } from '../src/lib/llm/ollama';
import { distillToolContextForLLM } from '../src/lib/llm/context-distiller';
import { execSync } from 'child_process';

const SYSTEM_INSTRUCTION = `You are AUREXO, an expert marine intelligence assistant for the Indian coast and maritime domain.
CORE RULES:
1. Ground your answers strictly in the verified observation data provided in the prompt.
2. NEVER invent, hallucinate, or alter any wave heights, temperatures, wind speeds, or coordinates.
3. Use precise satellite terminology: "satellite imagery", "satellite observation", "satellite-derived layer", and "retrieved observation time".
4. If an observation or data source is marked DOCUMENTED_UNVERIFIED or UNAVAILABLE, explicitly mention this to the user.
5. Provide actionable, practical safety advice for fishermen, navigators, and maritime operators.
6. Keep answers concise, clear, and professional. Use markdown formatting with bullet points.`;

function getOllamaPs(): string {
  try {
    const out = execSync('ollama ps', { encoding: 'utf-8', timeout: 5000 });
    return out.trim();
  } catch (err) {
    return 'ollama ps unavailable';
  }
}

interface BenchmarkRecord {
  scenario: string;
  model: string;
  promptCharCount: number;
  promptTokenCount: number;
  loadDurationMs: number;
  promptEvalDurationMs: number;
  evalCount: number;
  evalDurationMs: number;
  totalDurationMs: number;
  tokensPerSec: number;
  processor: string;
  responseSnippet: string;
}

const mockPointIntelligence = {
  location: 'Offshore Nagapattinam (10.76°N, 79.91°E)',
  weather: {
    temperature2mCelsius: 29.4,
    relativeHumidityPercent: 78,
    wind: { speedKmh: 18.5, gustsKmh: 24.1, beaufortDescription: 'Gentle Breeze' },
  },
  conditions: {
    wave: { heightMeters: 1.2, periodSeconds: 6.8, category: 'Slight' },
    seaSurfaceTemperatureCelsius: 28.6,
    currents: { velocityKmh: 1.9 },
  },
  geofence: {
    distanceToIMBLKm: 34.2,
    nearestNeighborCountry: 'Sri Lanka',
    isInsideMarineProtectedArea: false,
    riskStatus: 'Safe',
  },
  vesselData: {
    matchedVessel: null,
    nearestVessel: {
      vessel: { name: 'SAGAR TARA', vesselType: 'Research/Fishing', mmsi: 419000123 },
      distanceKm: 8.4,
    },
  },
  safetyAssessment: {
    compositeRiskScore: 84,
    riskLevel: 'LOW_RISK',
    primaryRiskFactor: 'Favorable wave and wind window',
    recommendedAction: 'Safe for artisanal and mechanized coastal fishing operations.',
  },
};

async function runBenchmark() {
  console.log('================================================================');
  console.log('       AUREXO OLLAMA HARDWARE & MODEL BENCHMARK (RTX 3050 4GB)   ');
  console.log('================================================================');
  console.log('Active Configuration:');
  console.log(`- Base URL: ${process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}`);
  console.log(`- Context Window: ${process.env.OLLAMA_CONTEXT_WINDOW || '2048'}`);
  console.log(`- Num Predict: ${process.env.OLLAMA_NUM_PREDICT || '384'}`);
  console.log(`- Keep Alive: ${process.env.OLLAMA_KEEP_ALIVE || '10m'}`);
  console.log(`- Timeout: ${process.env.OLLAMA_TIMEOUT_MS || '90000'}ms`);
  console.log('');

  const models = ['qwen3.5:4b', 'llama3.2:3b', 'llama3.2:1b'];
  const distilledContext = distillToolContextForLLM(mockPointIntelligence);

  const prompt = `User Request: "Check conditions at this point off Nagapattinam. Is it safe for fishing tonight?"
Identified Intent: POINT_INTELLIGENCE

VERIFIED TOOL DATA & SENSOR MEASUREMENTS:
${distilledContext}

Explain this verified data clearly to the user, highlighting safety conditions, boundary proximity, and actionable tactical recommendations according to your instructions.`;

  console.log('--- DISTILLED PROMPT PREVIEW ---');
  console.log(prompt);
  console.log('Prompt Character Count:', prompt.length);
  console.log('--------------------------------\n');

  const records: BenchmarkRecord[] = [];

  for (const model of models) {
    console.log(`\n>>> Testing Model: ${model} ...`);

    // Warm-up run to ensure model is in memory (warm synthesis measurement)
    process.stdout.write(`  Warming up ${model}... `);
    try {
      await generateWithOllama('Ping', { model, numPredict: 5, think: false });
      console.log('Done.');
    } catch (e) {
      console.log(`Warm-up note: ${e}`);
    }

    const psOutput = getOllamaPs();
    console.log(`  ollama ps state:\n  ${psOutput.replace(/\n/g, '\n  ')}`);

    // Parse processor placement from ollama ps
    let processor = 'Unknown';
    const lines = psOutput.split('\n');
    for (const line of lines) {
      if (line.includes(model.split(':')[0])) {
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 4) {
          processor = parts[parts.length - 2] || parts[3]; // Processor column
        }
      }
    }

    // Benchmark Run
    process.stdout.write(`  Executing real distilled synthesis against ${model}... `);
    const startWall = Date.now();
    try {
      const res = await generateWithOllama(prompt, {
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        think: false,
      });
      const endWall = Date.now();
      console.log(`Complete in ${endWall - startWall}ms`);

      const tps =
        res.evalCount && res.evalDurationMs && res.evalDurationMs > 0
          ? Number(((res.evalCount / (res.evalDurationMs / 1000))).toFixed(1))
          : 0;

      const record: BenchmarkRecord = {
        scenario: 'Point Intelligence (Warm)',
        model,
        promptCharCount: prompt.length,
        promptTokenCount: res.promptEvalCount ?? 0,
        loadDurationMs: res.loadDurationMs ?? 0,
        promptEvalDurationMs: res.promptEvalDurationMs ?? 0,
        evalCount: res.evalCount ?? 0,
        evalDurationMs: res.evalDurationMs ?? 0,
        totalDurationMs: res.totalDurationMs ?? (endWall - startWall),
        tokensPerSec: tps,
        processor,
        responseSnippet: res.text.slice(0, 180).replace(/\n/g, ' ') + '...',
      };

      records.push(record);
      console.log(`  Tokens: ${res.promptEvalCount} prompt tokens, ${res.evalCount} eval tokens`);
      console.log(`  Timing: PromptEval=${res.promptEvalDurationMs}ms, Eval=${res.evalDurationMs}ms, Total=${record.totalDurationMs}ms (${tps} tok/s)`);
      console.log(`  Snippet: "${record.responseSnippet}"\n`);
    } catch (err) {
      console.error(`  ERROR testing ${model}:`, err);
    }
  }

  console.log('\n================================================================');
  console.log('                     BENCHMARK SUMMARY TABLE                    ');
  console.log('================================================================');
  console.table(
    records.map((r) => ({
      Model: r.model,
      Processor: r.processor,
      'Prompt Tok': r.promptTokenCount,
      'PromptEval (ms)': r.promptEvalDurationMs,
      'Eval Count': r.evalCount,
      'Eval (ms)': r.evalDurationMs,
      'Total (ms)': r.totalDurationMs,
      'Tok/Sec': r.tokensPerSec,
      'Acceptance (<10s)': r.totalDurationMs < 10000 ? 'PASS' : 'FAIL',
    }))
  );

  console.log('\nFull Detailed JSON:');
  console.log(JSON.stringify(records, null, 2));
}

runBenchmark().catch(console.error);
