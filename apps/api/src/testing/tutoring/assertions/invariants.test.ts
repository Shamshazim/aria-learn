import { describe, expect, it } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { checkTutoringInvariants } from '@/testing/tutoring';
import {
  answerEvent,
  interruptEvent,
  questionEvent,
  transcript,
  turn,
} from '@/testing/tutoring/assertions/invariant-test-helpers';

describe('approach-change invariant', () => {
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
          expectedFactAssertions: [],
          expectedAffectCheckIns: [],
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
          expectedFactAssertions: [],
          expectedAffectCheckIns: [],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('APPROACH_NOT_CHANGED');
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
          expectedFactAssertions: [],
          expectedAffectCheckIns: [],
          safetyDisclosureEventIds: ['evt_safety'],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('SAFETY_NOT_CRISIS_ROUTED');
  });

  it('fails when an interruption does not stop the current move', () => {
    const speakingMove: TutorMove = {
      id: 'mov_speaking',
      at: '2026-08-23T10:00:00Z',
      protocolVersion: '1.1.0',
      kind: 'SAY',
      speech: { text: 'Here is an explanation.' },
      display: [],
      expects: 'none',
    };
    const result = checkTutoringInvariants(
      transcript([
        turn(questionEvent('evt_question', 'Can you explain?'), {}, [speakingMove]),
        turn(interruptEvent('evt_interrupt', speakingMove.id), {}),
      ]),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('INTERRUPTION_NOT_STOPPED');
  });

  it('fails when a stop action names a move that was never emitted', () => {
    const result = checkTutoringInvariants(
      transcript([
        turn(
          interruptEvent('evt_interrupt_unknown', 'mov_never_emitted'),
          {},
          [],
          ['mov_never_emitted'],
        ),
      ]),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('INTERRUPTION_NOT_STOPPED');
  });
});
