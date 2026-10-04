import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithOllama, OllamaError } from '../lib/llm/ollama';
import { synthesizeMarineResponse } from '../lib/llm/provider';

test('1. Ollama Real Request - llama3.2:3b generates grounded response or handles offline connection', async () => {
  const prompt = 'In 20 words, give one marine navigation safety rule for Indian coastal waters.';
  try {
    const res = await generateWithOllama(prompt, {
      model: 'llama3.2:3b',
      timeoutMs: 3000,
      think: false,
      numPredict: 64,
    });

    assert.ok(res.text.length > 10, 'Response should not be empty');
    assert.equal(res.model, 'llama3.2:3b');
    assert.ok(res.executionTimeMs > 0, 'Execution time should be measured');
  } catch (err: any) {
    // If local Ollama daemon is not running in test container, verify typed error
    assert.ok(err instanceof OllamaError);
    assert.ok(['CONNECTION_REFUSED', 'MODEL_NOT_FOUND', 'TIMEOUT'].includes(err.code));
  }
});

test('2. Ollama Timeout Handling - raises typed TIMEOUT error when deadline exceeded', async () => {
  await assert.rejects(
    async () => {
      // 10ms timeout should reliably trigger timeout abort or connection error
      await generateWithOllama('Write a long essay on the Indian Ocean monsoon cycles.', {
        model: 'qwen3.5:4b',
        timeoutMs: 1,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof OllamaError);
      assert.ok(err.code === 'TIMEOUT' || err.code === 'CONNECTION_REFUSED');
      return true;
    }
  );
});

test('3. Ollama Model Not Found - raises typed MODEL_NOT_FOUND or CONNECTION_REFUSED error', async () => {
  await assert.rejects(
    async () => {
      await generateWithOllama('Hello', {
        model: 'nonexistent-model-xyz-12345',
        timeoutMs: 10000,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof OllamaError);
      assert.ok(err.code === 'MODEL_NOT_FOUND' || err.code === 'CONNECTION_REFUSED');
      return true;
    }
  );
});

test('4. LLM Dispatcher Fallback Cascade - falls back gracefully with real tool data', async () => {
  // Save original API keys to restore after test
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalDhammu = process.env.DHAMMU_GEMINI_API_KEY;

  try {
    // Intentionally break Gemini to verify fallback to Ollama qwen3.5:4b
    delete process.env.GEMINI_API_KEY;
    delete process.env.DHAMMU_GEMINI_API_KEY;

    const res = await synthesizeMarineResponse({
      userPrompt: 'What are the current sea conditions?',
      intent: 'query_marine_conditions',
      toolData: {
        location: 'Mumbai Offshore',
        conditions: {
          wave: { heightMeters: 0.8, category: 'Moderate' },
          wind: { speedKmh: 12, beaufortDescription: 'Gentle breeze' },
          sst: 30.2,
        },
      },
    });

    // Should succeed via local Ollama qwen3.5:4b or fallback
    assert.ok(res.text.length > 20);
    assert.ok(res.provider === 'ollama' || res.provider === 'rule_fallback');
    assert.ok(res.executionTimeMs >= 0);
  } finally {
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
    if (originalDhammu) process.env.DHAMMU_GEMINI_API_KEY = originalDhammu;
  }
});

test('5. LLM Dispatcher - Ollama Secondary Fallback to llama3.2:1b when primary unavailable', async () => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalDhammu = process.env.DHAMMU_GEMINI_API_KEY;
  const originalPrimary = process.env.OLLAMA_PRIMARY_MODEL;

  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.DHAMMU_GEMINI_API_KEY;
    // Set invalid primary to force fallback to secondary llama3.2:1b
    process.env.OLLAMA_PRIMARY_MODEL = 'invalid-primary-model';

    const res = await synthesizeMarineResponse({
      userPrompt: 'Is it safe to sail from Kochi?',
      intent: 'evaluate_safety',
      toolData: {
        location: 'Kochi Offshore',
        safetyAssessment: {
          riskLevel: 'Minimal Risk',
          compositeRiskScore: 12,
        },
      },
    });

    assert.ok(res.text.length > 20);
    assert.ok(res.provider === 'ollama' || res.provider === 'rule_fallback');
    if (res.provider === 'ollama') {
      assert.equal(res.model, 'llama3.2:1b');
    }
  } finally {
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
    if (originalDhammu) process.env.DHAMMU_GEMINI_API_KEY = originalDhammu;
    if (originalPrimary) process.env.OLLAMA_PRIMARY_MODEL = originalPrimary;
  }
});
