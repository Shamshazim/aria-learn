import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  checkTutoringInvariants,
  INVARIANT_RULES,
  type InvariantReport,
} from '@/testing/tutoring/assertions/invariants';
import {
  createScriptedTutor,
  replayScenario,
  type ReplayClock,
  type TutorImplementation,
} from '@/testing/tutoring/replay';
import { loadTutoringScenarios, type TutoringScenario } from '@/testing/tutoring/scenario';
import { formatTranscript } from '@/testing/tutoring/transcript';

export type GoldenRunReport = Readonly<{
  passed: boolean;
  invariants: typeof INVARIANT_RULES;
  scenarios: readonly Readonly<{ scenarioId: string } & InvariantReport>[];
}>;

export type GoldenRunOptions = Readonly<{
  scenarioDirectory: string;
  outputDirectory: string;
  scenarioId?: string;
  tutorFactory?: TutorFactory;
}>;

export type TutorFactory = (scenario: TutoringScenario) => TutorImplementation;

function deterministicClock(): ReplayClock {
  let elapsedMs = 0;
  return {
    now() {
      const current = elapsedMs;
      elapsedMs += 10;
      return current;
    },
  };
}

function chooseScenarios<T extends Readonly<{ id: string }>>(
  scenarios: readonly T[],
  scenarioId: string | undefined,
): readonly T[] {
  if (scenarioId === undefined) return scenarios;
  const selected = scenarios.filter((scenario) => scenario.id === scenarioId);
  if (selected.length === 0) throw new Error(`Unknown tutoring scenario: ${scenarioId}.`);
  return selected;
}

export async function runTutoringGoldenSet(options: GoldenRunOptions): Promise<GoldenRunReport> {
  const loaded = await loadTutoringScenarios(options.scenarioDirectory);
  const scenarios = chooseScenarios(loaded, options.scenarioId);
  const tutorFactory = options.tutorFactory ?? createScriptedTutor;
  await mkdir(options.outputDirectory, { recursive: true });
  const results: Readonly<{ scenarioId: string } & InvariantReport>[] = [];

  for (const scenario of scenarios) {
    const transcript = await replayScenario(scenario, tutorFactory(scenario), deterministicClock());
    const invariantReport = checkTutoringInvariants(transcript);
    results.push({ scenarioId: scenario.id, ...invariantReport });
    await writeFile(
      path.join(options.outputDirectory, `${scenario.id}.md`),
      formatTranscript(transcript),
      'utf8',
    );
  }

  const report = {
    passed: results.every((result) => result.passed),
    invariants: INVARIANT_RULES,
    scenarios: results,
  };
  await writeFile(
    path.join(options.outputDirectory, 'invariant-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  return report;
}
