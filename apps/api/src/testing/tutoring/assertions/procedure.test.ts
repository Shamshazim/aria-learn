import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkProcedureReveals } from '@/testing/tutoring/assertions/procedure';
import { createHarnessTutor } from '@/testing/tutoring/harness-adapter';
import { replayScenario } from '@/testing/tutoring/replay';
import { loadTutoringScenarios } from '@/testing/tutoring/scenario';

const SCENARIO_DIRECTORY = fileURLToPath(
  new URL('../../../../../../dev-docs/golden/tutoring/scenarios/', import.meta.url),
);

async function longDivision() {
  const scenarios = await loadTutoringScenarios(SCENARIO_DIRECTORY);
  const scenario = scenarios.find((item) => item.id === 'long-division');
  if (scenario === undefined) throw new Error('long-division scenario is missing');
  return scenario;
}

describe('the long-division scenario (P3-07)', () => {
  it('runs the real policy: a hint per step, then a change of ground, never a reveal', async () => {
    const scenario = await longDivision();
    const transcript = await replayScenario(scenario, createHarnessTutor(scenario));
    expect(
      transcript.turns.map((turn) => [turn.evidence.plannedMove, turn.evidence.approachId]),
    ).toEqual([
      ['HINT', 'point-to-step:1'],
      ['HINT', 'point-to-step:2'],
      ['HINT', 'point-to-step:3'],
      ['HINT', 'point-to-step:4'],
      ['SWITCH', 'prerequisite-step'],
    ]);
    expect(checkProcedureReveals(transcript)).toEqual([]);
  });

  it('names a reveal that comes before the last step', async () => {
    const scenario = await longDivision();
    const transcript = await replayScenario(scenario, createHarnessTutor(scenario));
    const early = {
      ...transcript,
      turns: transcript.turns.map((turn, index) =>
        index === 2 ? { ...turn, evidence: { ...turn.evidence, plannedMove: 'REVEAL' } } : turn,
      ),
    };
    expect(checkProcedureReveals(early)).toEqual([
      expect.objectContaining({ code: 'REVEAL_BEFORE_STEPS', eventId: 'evt_long_division_3' }),
    ]);
  });
});
