import { describe, expect, it } from 'vitest';

import { formatTranscript, type TutoringTranscript } from '@/testing/tutoring';

const SUPPORTED_FACT = {
  id: 'fact_prior_effort',
  claim: 'The learner persisted in the prior session.',
  evidenceIds: ['session_event_42'],
};

describe('formatTranscript', () => {
  it('renders events, moves, timings, and evidence as readable Markdown', () => {
    const transcript: TutoringTranscript = {
      scenarioId: 'arrival-after-absence',
      title: 'Arrival after an absence',
      grade: '4',
      description: 'A returning learner is welcomed.',
      context: {
        answerOutcomes: [],
        learnerFacts: [SUPPORTED_FACT],
        affectObservations: [],
        expectedFactAssertions: [],
        expectedAffectCheckIns: [],
        safetyDisclosureEventIds: [],
      },
      turns: [
        {
          event: {
            id: 'evt_arrived',
            at: '2026-08-23T10:00:00Z',
            protocolVersion: '1.1.0',
            kind: 'ARRIVED',
          },
          moves: [
            {
              id: 'mov_welcome',
              at: '2026-08-23T10:00:00Z',
              protocolVersion: '1.1.0',
              kind: 'WELCOME',
              speech: { text: 'Welcome back.' },
              display: [],
              expects: 'none',
              basedOn: [],
            },
          ],
          durationMs: 12,
          stoppedMoveIds: [],
          continuedMoveIds: [],
          evidence: {
            assertedFactIds: ['fact_prior_effort'],
            affectClaims: [],
            responseOrigin: 'scripted',
            crisisRouted: false,
          },
        },
      ],
    };

    const markdown = formatTranscript(transcript);

    expect(markdown).toContain('## Turn 1 — ARRIVED');
    expect(markdown).toContain('Grade: 4 · Band: middle');
    expect(markdown).toContain('12 ms');
    expect(markdown).toContain('WELCOME `mov_welcome`: Welcome back.');
    expect(markdown).toContain('"basedOn": []');
    expect(markdown).toContain('session_event_42');
    expect(markdown).toContain('Response origin: scripted');
  });
});
