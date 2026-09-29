import test from 'node:test';
import assert from 'node:assert/strict';
import { runSupervisorAgent } from '../lib/agents/supervisor';

test('Supervisor orchestrates vessel query with structured map action', async () => {
  const res = await runSupervisorAgent({
    prompt: 'Which vessel is closest to Mumbai?',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('query_vessel_fleet'));
  assert.ok(res.swarmTrace);
  assert.ok(res.swarmTrace.steps.some((s) => s.agentName === 'Vessel'));
  assert.ok(res.mapActions);
  assert.ok(res.mapActions.marker);
  assert.equal(res.mapActions.marker.variant, 'vessel');
  assert.ok(res.evidence.sources.some((s) => s.name.includes('AIS Vessel Fleet')));
});

test('Supervisor orchestrates regional active warnings query across all 9 sectors', async () => {
  const res = await runSupervisorAgent({
    prompt: 'Which regions currently have active marine warnings?',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('scan_active_regional_warnings'));
  assert.ok(res.swarmTrace);
  assert.ok(res.swarmTrace.steps.some((s) => s.agentName === 'WeatherHazard'));
  assert.ok(res.suggestedQueries.length > 0);
});

test('Supervisor resolves multi-turn anaphora from sessionContext', async () => {
  // Turn 1 establishes Mumbai Offshore context
  const turn1 = await runSupervisorAgent({
    prompt: 'What is the sea temperature near Mumbai?',
  });

  assert.ok(turn1.sessionContext);
  assert.ok(turn1.sessionContext.lastCoordinates);

  // Turn 2 does not mention Mumbai explicitly ("What about waves?")
  const turn2 = await runSupervisorAgent({
    prompt: 'What about waves?',
    sessionContext: turn1.sessionContext,
  });

  assert.ok(turn2.swarmTrace);
  // Confirms anaphora resolution was applied by Supervisor
  const resolvedStep = turn2.swarmTrace.steps.find((s) =>
    s.action.includes('Anaphora Resolved')
  );
  assert.ok(resolvedStep, 'Expected Anaphora Resolved step in supervisor trace');
  assert.ok(turn2.mapActions.center);
});
