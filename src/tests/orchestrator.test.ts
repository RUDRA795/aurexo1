import test from 'node:test';
import assert from 'node:assert/strict';
import { processAgentQuery } from '../lib/orchestrator/engine';

test('processAgentQuery processes natural language query and returns grounded response', async () => {
  const query = 'Check wave and sea conditions off Mumbai';
  const res = await processAgentQuery(query);

  // 1. Structure assertions
  assert.ok(res.answer.length > 20, 'Answer must be non-empty and substantive');
  assert.ok(res.toolsUsed.includes('get_marine_conditions'));
  assert.ok(res.evidence.sources.length > 0);
  assert.ok(res.evidence.sources.some((s) => s.status === 'VERIFIED_LIVE'));

  // 2. Map Actions
  assert.ok(res.mapActions?.center);
  assert.equal(typeof res.mapActions.center[0], 'number'); // longitude
  assert.equal(typeof res.mapActions.center[1], 'number'); // latitude

  // 3. LLM Metadata
  assert.ok(['gemini', 'ollama', 'rule_fallback'].includes(res.llmMetadata.provider));
  assert.equal(typeof res.llmMetadata.executionTimeMs, 'number');
});

test('processAgentQuery handles IMBL border proximity query', async () => {
  const query = 'Is it safe to venture 10km west from Rameswaram towards Sri Lanka?';
  const res = await processAgentQuery(query);

  assert.ok(res.toolsUsed.includes('check_geofence_and_boundaries'));
  assert.ok(res.evidence.geofence);
  assert.equal(typeof res.evidence.geofence.distanceToIMBLKm, 'number');
  assert.ok(res.answer.toLowerCase().includes('sri lanka') || res.answer.toLowerCase().includes('boundary') || res.answer.toLowerCase().includes('imbl'));
});
