import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  checkTutoringInvariants,
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
});
