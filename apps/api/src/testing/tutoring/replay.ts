import type { TutorInputEvent, TutorMove } from '@aria/shared';

import type { TurnEvidence, TutoringScenario } from '@/testing/tutoring/scenario';
import type { TranscriptTurn, TutoringTranscript } from '@/testing/tutoring/transcript';

export type TutorTurnResult = Readonly<{
  moves: readonly TutorMove[];
  evidence: TurnEvidence;
}>;

/** The scripted source and P1-06 loop both satisfy this replay seam. */
export type TutorImplementation = Readonly<{
  handle(event: TutorInputEvent): TutorTurnResult | Promise<TutorTurnResult>;
}>;

export type ReplayClock = Readonly<{ now(): number }>;

const WALL_CLOCK: ReplayClock = { now: () => performance.now() };

export function createScriptedTutor(scenario: TutoringScenario): TutorImplementation {
  const turnsByEventId = new Map(scenario.steps.map((step) => [step.event.id, step.scripted]));
  return {
    handle(event) {
      const scripted = turnsByEventId.get(event.id);
      if (scripted === undefined) throw new Error(`No scripted turn for event ${event.id}.`);
      return scripted;
    },
  };
}

async function replayTurn(
  event: TutorInputEvent,
  tutor: TutorImplementation,
  clock: ReplayClock,
): Promise<TranscriptTurn> {
  const startedAt = clock.now();
  const result = await tutor.handle(event);
  const durationMs = clock.now() - startedAt;
  return { event, moves: result.moves, durationMs, evidence: result.evidence };
}

export async function replayScenario(
  scenario: TutoringScenario,
  tutor: TutorImplementation,
  clock: ReplayClock = WALL_CLOCK,
): Promise<TutoringTranscript> {
  const turns: TranscriptTurn[] = [];
  for (const step of scenario.steps) {
    turns.push(await replayTurn(step.event, tutor, clock));
  }
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    grade: scenario.grade,
    description: scenario.description,
    context: scenario.context,
    turns,
  };
}
