import test from 'node:test';
import assert from 'node:assert/strict';
import { runSupervisorAgent } from '../lib/agents/supervisor';
import { sanitizeMarkdownFormatting } from '../lib/llm/provider';

test('1. Supervisor handles inland city queries (Delhi) accurately without hallucinating sea states', async () => {
  const res = await runSupervisorAgent({
    prompt: 'tell me about delhi',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('query_inland_territory_gateway'));
  assert.ok(res.answer.toLowerCase().includes('inland'));
  assert.ok(
    res.answer.includes('Kandla') ||
    res.answer.includes('Mundra') ||
    res.answer.includes('Mumbai') ||
    res.answer.includes('coastline')
  );
  // Must not have LaTeX math markers
  assert.ok(!res.answer.includes('$\\text{'));
  assert.ok(!res.answer.includes('^\\circ'));
  assert.ok(res.mapActions);
  assert.ok(res.suggestedQueries && res.suggestedQueries.length > 0);
});

test('2. Supervisor handles inland tech metro (Bengaluru) with maritime gateways', async () => {
  const res = await runSupervisorAgent({
    prompt: 'What about Bengaluru?',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('query_inland_territory_gateway'));
  assert.ok(res.answer.toLowerCase().includes('bengaluru'));
  assert.ok(res.answer.toLowerCase().includes('mangalore') || res.answer.toLowerCase().includes('chennai'));
});

test('3. Supervisor handles conversational greeting & capabilities inquiry naturally', async () => {
  const res = await runSupervisorAgent({
    prompt: 'hello, who are you and what can you do?',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('conversational_copilot_overview'));
  assert.ok(
    res.answer.toLowerCase().includes('aurexo') ||
    res.answer.toLowerCase().includes('orca') ||
    res.answer.toLowerCase().includes('maritime')
  );
  assert.ok(res.suggestedQueries && res.suggestedQueries.length >= 3);
});

test('4. Supervisor explains maritime domain concepts (Kallakkadal / Swell Surge)', async () => {
  const res = await runSupervisorAgent({
    prompt: 'explain what is kallakkadal and what causes it',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('explain_oceanographic_concept'));
  assert.ok(res.answer.toLowerCase().includes('kallakkadal') || res.answer.toLowerCase().includes('swell'));
  assert.ok(res.evidence.sources.some((s) => s.name.includes('Scientific Reference')));
});

test('5. Supervisor orchestrates vessel query with structured map action', async () => {
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

test('6. Supervisor orchestrates regional active warnings query across all 9 sectors', async () => {
  const res = await runSupervisorAgent({
    prompt: 'Which regions currently have active marine warnings?',
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('scan_active_regional_warnings'));
  assert.ok(res.swarmTrace);
  assert.ok(res.swarmTrace.steps.some((s) => s.agentName === 'WeatherHazard'));
  assert.ok(res.suggestedQueries && res.suggestedQueries.length > 0);
});

test('7. Supervisor resolves multi-turn anaphora from sessionContext', async () => {
  const turn1 = await runSupervisorAgent({
    prompt: 'What is the sea temperature near Mumbai?',
  });

  assert.ok(turn1.sessionContext);
  assert.ok(turn1.sessionContext.lastCoordinates);

  const turn2 = await runSupervisorAgent({
    prompt: 'What about waves?',
    sessionContext: turn1.sessionContext,
  });

  assert.ok(turn2.swarmTrace);
  const resolvedStep = turn2.swarmTrace.steps.find((s) =>
    s.action.includes('Anaphora Resolved')
  );
  assert.ok(resolvedStep, 'Expected Anaphora Resolved step in supervisor trace');
  assert.ok(turn2.mapActions && turn2.mapActions.center);
});

test('8. Markdown Sanitizer eliminates LaTeX formatting artifacts', () => {
  const raw = 'The SST is $30.2^\\circ\\text{C}$ and wave height is $0.56\\text{ m}$ with wind $8.1\\text{ km/h}$. Distance is $708.3\\text{ km}$.';
  const clean = sanitizeMarkdownFormatting(raw);
  assert.equal(clean, 'The SST is 30.2°C and wave height is 0.56 m with wind 8.1 km/h. Distance is 708.3 km.');
});

test('9. Supervisor handles Nagpur inland query even when userCoordinates is passed', async () => {
  const res = await runSupervisorAgent({
    prompt: 'nagpur',
    userCoordinates: { latitude: 18.95, longitude: 72.80 }, // Default map selection
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('query_inland_territory_gateway'));
  assert.ok(res.answer.toLowerCase().includes('nagpur'));
  assert.ok(res.answer.toLowerCase().includes('inland'));
  assert.ok(res.answer.includes('Visakhapatnam') || res.answer.includes('Mumbai'));
});

test('10. Supervisor handles international country query (China) with strategic sea lanes', async () => {
  const res = await runSupervisorAgent({
    prompt: 'tell me about china',
    userCoordinates: { latitude: 18.95, longitude: 72.80 },
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('query_international_territory_corridor'));
  assert.ok(res.answer.toLowerCase().includes('china'));
  assert.ok(res.answer.toLowerCase().includes('malacca') || res.answer.toLowerCase().includes('shipping'));
});

test('11. Supervisor handles India to Sri Lanka travel route and corridor mapping', async () => {
  const res = await runSupervisorAgent({
    prompt: 'i want to travel from the india to sri lanka',
    userCoordinates: { latitude: 18.95, longitude: 72.80 },
  });

  assert.ok(res.answer.length > 0);
  assert.ok(res.toolsUsed.includes('compute_safe_passage'));
  assert.ok(res.mapActions?.highlightGeometry);
  assert.ok(res.sessionContext?.lastLocationName?.includes('Sri Lanka') || res.sessionContext?.lastLocationName?.includes('Talaimannar'));
});

test('12. Supervisor handles follow-up "wheather" query on active route corridor', async () => {
  const routeTurn = await runSupervisorAgent({
    prompt: 'i am travrlling from india to sri lanka',
  });

  assert.ok(routeTurn.sessionContext?.lastLocationName);

  const weatherFollowUp = await runSupervisorAgent({
    prompt: 'wheather',
    sessionContext: routeTurn.sessionContext,
  });

  assert.ok(weatherFollowUp.toolsUsed.includes('query_corridor_voyage_weather'));
  assert.ok(weatherFollowUp.answer.length > 0);
  assert.ok(
    weatherFollowUp.answer.toLowerCase().includes('corridor') ||
    weatherFollowUp.answer.toLowerCase().includes('passage') ||
    weatherFollowUp.answer.toLowerCase().includes('departure') ||
    weatherFollowUp.answer.toLowerCase().includes('wave')
  );
});
