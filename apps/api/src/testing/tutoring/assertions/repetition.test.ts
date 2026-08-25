import { describe, expect, it } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { checkTutoringInvariants } from '@/testing/tutoring';
import {
  answerEvent,
  transcript,
  turn,
} from '@/testing/tutoring/assertions/invariant-test-helpers';

const EMPTY_CONTEXT = {
  answerOutcomes: [],
  learnerFacts: [],
  affectObservations: [],
  expectedFactAssertions: [],
  expectedAffectCheckIns: [],
  safetyDisclosureEventIds: [],
};

function say(id: string, text: string): TutorMove {
  return {
    id,
    at: '2026-08-25T10:00:00Z',
    protocolVersion: '1.1.0',
    kind: 'SAY',
    speech: { text },
    display: [],
    expects: 'none',
  };
}

function codesFor(moves: readonly (readonly [string, TutorMove[]])[]): readonly string[] {
  return checkTutoringInvariants(
    transcript(
      moves.map(([eventId, turnMoves]) => turn(answerEvent(eventId, 'mov_ask'), {}, turnMoves)),
      EMPTY_CONTEXT,
    ),
  ).findings.map((finding) => finding.code);
}

describe('repeated-sentence invariant', () => {
  it('fails when Aria says the same sentence twice in a row', () => {
    expect(
      codesFor([
        ['evt_1', [say('mov_1', 'Take your time.')]],
        ['evt_2', [say('mov_2', 'Take your time.')]],
      ]),
    ).toContain('SENTENCE_REPEATED');
  });

  it('ignores case and spacing, because a listener does', () => {
    expect(
      codesFor([
        ['evt_1', [say('mov_1', 'Take your time.')]],
        ['evt_2', [say('mov_2', 'take   your time.')]],
      ]),
    ).toContain('SENTENCE_REPEATED');
  });

  it('catches a repeat inside one turn, not only across turns', () => {
    expect(
      codesFor([['evt_1', [say('mov_1', 'Try again.'), say('mov_2', 'Try again.')]]]),
    ).toContain('SENTENCE_REPEATED');
  });

  it('allows a sentence to come back later once something else was said', () => {
    expect(
      codesFor([
        ['evt_1', [say('mov_1', 'Try again.')]],
        ['evt_2', [say('mov_2', 'Count on from four.')]],
        ['evt_3', [say('mov_3', 'Try again.')]],
      ]),
    ).not.toContain('SENTENCE_REPEATED');
  });

  it('never fires on moves with nothing to say', () => {
    const silent: TutorMove = { ...say('mov_1', 'x'), speech: null };
    expect(
      codesFor([
        ['evt_1', [silent]],
        ['evt_2', [{ ...silent, id: 'mov_2' }]],
      ]),
    ).not.toContain('SENTENCE_REPEATED');
  });
});
