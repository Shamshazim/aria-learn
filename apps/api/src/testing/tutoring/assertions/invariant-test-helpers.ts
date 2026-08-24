import type { TutorInputEvent, TutorMove } from '@aria/shared';

import {
  turnEvidenceSchema,
  type TranscriptTurn,
  type TurnEvidence,
  type TutoringTranscript,
} from '@/testing/tutoring';

export function answerEvent(id: string, respondsTo: string): TutorInputEvent {
  return {
    id,
    at: '2026-08-23T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'ANSWER',
    respondsTo,
    text: '5',
  };
}

export function questionEvent(id: string, text: string): TutorInputEvent {
  return {
    id,
    at: '2026-08-23T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'QUESTION',
    text,
  };
}

export function interruptEvent(id: string, interruptedMoveId: string): TutorInputEvent {
  return {
    id,
    at: '2026-08-23T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'INTERRUPT',
    interruptedMoveId,
  };
}

export function turn(
  event: TutorInputEvent,
  evidence: Partial<TurnEvidence>,
  moves: readonly TutorMove[] = [],
  stoppedMoveIds: readonly string[] = [],
): TranscriptTurn {
  return {
    event,
    moves,
    durationMs: 10,
    evidence: turnEvidenceSchema.parse(evidence),
    stoppedMoveIds,
    continuedMoveIds: [],
  };
}

export function transcript(
  turns: readonly TranscriptTurn[],
  context: TutoringTranscript['context'] = {
    answerOutcomes: [],
    learnerFacts: [],
    affectObservations: [],
    expectedFactAssertions: [],
    expectedAffectCheckIns: [],
    safetyDisclosureEventIds: [],
  },
): TutoringTranscript {
  return {
    scenarioId: 'failing-fixture',
    title: 'Deliberately failing fixture',
    grade: '4',
    description: 'Proves an invariant catches a regression.',
    context,
    turns,
  };
}
