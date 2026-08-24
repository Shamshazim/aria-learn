import { describe, expect, it } from 'vitest';

import type { TutorInputEvent, TutorMove } from '@aria/shared';

import {
  checkTutoringInvariants,
  turnEvidenceSchema,
  type TranscriptTurn,
  type TurnEvidence,
  type TutoringTranscript,
} from '@/testing/tutoring';

function answerEvent(id: string, respondsTo: string): TutorInputEvent {
  return {
    id,
    at: '2026-08-23T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'ANSWER',
    respondsTo,
    text: '5',
  };
}

function questionEvent(id: string, text: string): TutorInputEvent {
  return {
    id,
    at: '2026-08-23T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'QUESTION',
    text,
  };
}

function interruptEvent(id: string, interruptedMoveId: string): TutorInputEvent {
  return {
    id,
    at: '2026-08-23T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'INTERRUPT',
    interruptedMoveId,
  };
}

function turn(
  event: TutorInputEvent,
  evidence: Partial<TurnEvidence>,
  moves: readonly TutorMove[] = [],
): TranscriptTurn {
  return { event, moves, durationMs: 10, evidence: turnEvidenceSchema.parse(evidence) };
}

function transcript(
  turns: readonly TranscriptTurn[],
  context: TutoringTranscript['context'] = {
    answerOutcomes: [],
    learnerFacts: [],
    affectObservations: [],
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

describe('checkTutoringInvariants', () => {
  it('fails when two wrong answers reuse the same approach', () => {
    const result = checkTutoringInvariants(
      transcript(
        [
          turn(answerEvent('evt_wrong_1', 'mov_ask_1'), {
            approachId: 'verbal-explanation',
          }),
          turn(answerEvent('evt_wrong_2', 'mov_ask_2'), {
            approachId: 'verbal-explanation',
          }),
        ],
        {
          answerOutcomes: [
            { eventId: 'evt_wrong_1', outcome: 'wrong' },
            { eventId: 'evt_wrong_2', outcome: 'wrong' },
          ],
          learnerFacts: [],
          affectObservations: [],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toContain('APPROACH_NOT_CHANGED');
  });

  it('fails when consecutive wrong answers omit approach evidence', () => {
    const result = checkTutoringInvariants(
      transcript(
        [
          turn(answerEvent('evt_untraced_1', 'mov_ask_1'), {}),
          turn(answerEvent('evt_untraced_2', 'mov_ask_2'), {}),
        ],
        {
          answerOutcomes: [
            { eventId: 'evt_untraced_1', outcome: 'wrong' },
            { eventId: 'evt_untraced_2', outcome: 'wrong' },
          ],
          learnerFacts: [],
          affectObservations: [],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('APPROACH_NOT_CHANGED');
  });
});

describe('evidence-backed tutoring invariants', () => {
  it('fails when an asserted durable fact has no supporting evidence', () => {
    const result = checkTutoringInvariants(
      transcript(
        [turn(answerEvent('evt_fact', 'mov_ask'), { assertedFactIds: ['fact_breakthrough'] })],
        {
          answerOutcomes: [],
          learnerFacts: [
            { id: 'fact_breakthrough', claim: 'You solved regrouping.', evidenceIds: [] },
          ],
          affectObservations: [],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('FACT_WITHOUT_EVIDENCE');
  });

  it('fails when low-confidence affect is stated instead of checked', () => {
    const sayMove: TutorMove = {
      id: 'mov_affect_claim',
      at: '2026-08-23T10:00:00Z',
      protocolVersion: '1.1.0',
      kind: 'SAY',
      speech: { text: 'You are tired today.' },
      display: [],
      expects: 'none',
    };
    const result = checkTutoringInvariants(
      transcript(
        [
          turn(
            answerEvent('evt_affect', 'mov_ask'),
            { affectClaims: [{ observationId: 'affect_tired', moveId: sayMove.id }] },
            [sayMove],
          ),
        ],
        {
          answerOutcomes: [],
          learnerFacts: [],
          affectObservations: [
            { id: 'affect_tired', claim: 'The learner may be tired.', confidence: 'low' },
          ],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('AFFECT_STATED_AS_FACT');
  });
});

describe('safety and interruption invariants', () => {
  it('fails when a safety disclosure reaches a model response', () => {
    const result = checkTutoringInvariants(
      transcript(
        [
          turn(questionEvent('evt_safety', 'I do not feel safe at home.'), {
            responseOrigin: 'model',
            crisisRouted: false,
          }),
        ],
        {
          answerOutcomes: [],
          learnerFacts: [],
          affectObservations: [],
          safetyDisclosureEventIds: ['evt_safety'],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('SAFETY_NOT_CRISIS_ROUTED');
  });

  it('fails when an interruption does not stop the current move', () => {
    const result = checkTutoringInvariants(
      transcript([turn(interruptEvent('evt_interrupt', 'mov_speaking'), { stoppedMoveIds: [] })]),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('INTERRUPTION_NOT_STOPPED');
  });
});
