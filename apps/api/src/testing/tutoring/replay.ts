import type { TutorInputEvent, TutorMove } from '@aria/shared';

import type { TurnEvidence, TutoringScenario } from '@/testing/tutoring/scenario';
import type { TranscriptTurn, TutoringTranscript } from '@/testing/tutoring/transcript';

export type TutorTurnResult = Readonly<{
  moves: readonly TutorMove[];
  evidence: TurnEvidence;
}>;

export type TutorReplayControl = Readonly<{
  /** Cancels actual move delivery; replay records the call independently from tutor evidence. */
  stopMove(moveId: string): void;
}>;

/** The scripted source and the P1-06 loop adapter both satisfy this replay seam. */
export type TutorImplementation = Readonly<{
  handle(
    event: TutorInputEvent,
    control: TutorReplayControl,
  ): TutorTurnResult | Promise<TutorTurnResult>;
}>;

export type ReplayClock = Readonly<{ now(): number }>;

type ReplayDeliveryState = {
  activeMoveIds: Set<string>;
  stoppedMoveIds: Set<string>;
};

const WALL_CLOCK: ReplayClock = { now: () => performance.now() };

export function createScriptedTutor(scenario: TutoringScenario): TutorImplementation {
  const turnsByEventId = new Map(scenario.steps.map((step) => [step.event.id, step.scripted]));
  return {
    handle(event, control) {
      const scripted = turnsByEventId.get(event.id);
      if (scripted === undefined) throw new Error(`No scripted turn for event ${event.id}.`);
      for (const moveId of scripted.stopMoveIds) control.stopMove(moveId);
      return scripted;
    },
  };
}

async function replayTurn(
  event: TutorInputEvent,
  tutor: TutorImplementation,
  clock: ReplayClock,
  delivery: ReplayDeliveryState,
): Promise<TranscriptTurn> {
  const startedAt = clock.now();
  const stoppedMoveIds = new Set<string>();
  const result = await tutor.handle(event, {
    stopMove(moveId) {
      if (!delivery.activeMoveIds.delete(moveId)) return;
      delivery.stoppedMoveIds.add(moveId);
      stoppedMoveIds.add(moveId);
    },
  });
  const continuedMoveIds = result.moves
    .filter((move) => delivery.stoppedMoveIds.has(move.id))
    .map((move) => move.id);
  for (const move of result.moves) {
    if (!delivery.stoppedMoveIds.has(move.id)) delivery.activeMoveIds.add(move.id);
  }
  const durationMs = clock.now() - startedAt;
  return {
    event,
    moves: result.moves,
    durationMs,
    evidence: result.evidence,
    stoppedMoveIds: [...stoppedMoveIds],
    continuedMoveIds,
  };
}

export async function replayScenario(
  scenario: TutoringScenario,
  tutor: TutorImplementation,
  clock: ReplayClock = WALL_CLOCK,
): Promise<TutoringTranscript> {
  const turns: TranscriptTurn[] = [];
  const delivery: ReplayDeliveryState = {
    activeMoveIds: new Set<string>(),
    stoppedMoveIds: new Set<string>(),
  };
  for (const step of scenario.steps) {
    turns.push(await replayTurn(step.event, tutor, clock, delivery));
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
