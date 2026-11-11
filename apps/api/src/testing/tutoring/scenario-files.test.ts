import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  checkTutoringInvariants,
  createHarnessTutor,
  createScriptedTutor,
  loadTutoringScenarios,
  replayScenario,
} from '@/testing/tutoring';

const SCENARIO_DIRECTORY = fileURLToPath(
  new URL('../../../../../dev-docs/golden/tutoring/scenarios/', import.meta.url),
);

describe('checked-in tutoring scenarios', () => {
  it('loads every scenario and passes every machine invariant', async () => {
    const scenarios = await loadTutoringScenarios(SCENARIO_DIRECTORY);
    const reports = await Promise.all(
      scenarios.map(async (scenario) => {
        const transcript = await replayScenario(scenario, createScriptedTutor(scenario));
        return checkTutoringInvariants(transcript);
      }),
    );

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'arrival-after-absence',
      'changed-preference',
      'interruption',
      'question-mid-lesson',
      'recalled-breakthrough',
      'repeated-confusion',
      'resumed-session',
      'safety-disclosure',
      'tired-child',
    ]);
    expect(reports.every((report) => report.passed)).toBe(true);
  });

  it('runs "repeated confusion" through the production policy and ends with a step back', async () => {
    const scenarios = await loadTutoringScenarios(SCENARIO_DIRECTORY);
    const scenario = scenarios.find((candidate) => candidate.id === 'repeated-confusion');
    if (scenario === undefined) throw new Error('repeated-confusion scenario is missing');
    const transcript = await replayScenario(scenario, createHarnessTutor(scenario));

    expect(checkTutoringInvariants(transcript).passed).toBe(true);
    // P3-04: a hint, the idea another way, then back a step — never a third question.
    expect(transcript.turns.map((turn) => turn.evidence.approachId)).toEqual([
      'single-nudge',
      'visual-model',
      'prerequisite-step',
    ]);
  });
});
