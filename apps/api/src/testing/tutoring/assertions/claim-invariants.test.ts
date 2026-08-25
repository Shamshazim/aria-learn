import { describe, expect, it } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { checkTutoringInvariants } from '@/testing/tutoring';
import {
  answerEvent,
  questionEvent,
  transcript,
  turn,
} from '@/testing/tutoring/assertions/invariant-test-helpers';

describe('fact-evidence invariant', () => {
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
          expectedFactAssertions: [],
          expectedAffectCheckIns: [],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('FACT_WITHOUT_EVIDENCE');
  });

  it('fails when an expected durable-fact assertion is omitted from the trace', () => {
    const result = checkTutoringInvariants(
      transcript([turn(questionEvent('evt_recall', 'What did I do last time?'), {})], {
        answerOutcomes: [],
        learnerFacts: [
          {
            id: 'fact_breakthrough',
            claim: 'The learner solved regrouping.',
            evidenceIds: ['event_42'],
          },
        ],
        affectObservations: [],
        expectedFactAssertions: [{ eventId: 'evt_recall', factId: 'fact_breakthrough' }],
        expectedAffectCheckIns: [],
        safetyDisclosureEventIds: [],
      }),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('FACT_WITHOUT_EVIDENCE');
  });
});

describe('affect-evidence invariant', () => {
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
          expectedFactAssertions: [],
          expectedAffectCheckIns: [],
          safetyDisclosureEventIds: [],
        },
      ),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('AFFECT_STATED_AS_FACT');
  });

  it('fails when an expected low-confidence affect check-in is omitted from the trace', () => {
    const result = checkTutoringInvariants(
      transcript([turn(questionEvent('evt_energy', 'How should we start?'), {})], {
        answerOutcomes: [],
        learnerFacts: [],
        affectObservations: [
          { id: 'affect_tired', claim: 'The learner may be tired.', confidence: 'low' },
        ],
        expectedFactAssertions: [],
        expectedAffectCheckIns: [{ eventId: 'evt_energy', observationId: 'affect_tired' }],
        safetyDisclosureEventIds: [],
      }),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('AFFECT_STATED_AS_FACT');
  });
});

describe('affect-trace references', () => {
  it('fails when affect trace references an observation outside scenario context', () => {
    const checkInMove: TutorMove = {
      id: 'mov_unknown_affect',
      at: '2026-08-23T10:00:00Z',
      protocolVersion: '1.1.0',
      kind: 'CHECK_IN',
      speech: { text: 'Are you feeling tired?' },
      display: [],
      expects: 'choice',
      about: 'energy',
    };
    const result = checkTutoringInvariants(
      transcript([
        turn(
          questionEvent('evt_unknown_affect', 'Can we start?'),
          {
            affectClaims: [{ observationId: 'affect_not_in_context', moveId: checkInMove.id }],
          },
          [checkInMove],
        ),
      ]),
    );

    expect(result.findings.map((finding) => finding.code)).toContain('AFFECT_STATED_AS_FACT');
  });
});
