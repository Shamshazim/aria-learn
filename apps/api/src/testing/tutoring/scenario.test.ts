import { describe, expect, it } from 'vitest';

import { parseTutoringScenario } from '@/testing/tutoring';

function validScenarioInput() {
  return {
    id: 'arrival-after-absence',
    title: 'Arrival after an absence',
    grade: '3',
    description: 'A returning learner is welcomed from supported evidence.',
    context: {
      answerOutcomes: [],
      learnerFacts: [],
      affectObservations: [],
      safetyDisclosureEventIds: [],
    },
    steps: [
      {
        event: {
          id: 'evt_arrived',
          at: '2026-08-23T10:00:00Z',
          protocolVersion: '1.1.0',
          kind: 'ARRIVED',
          grade: '3',
        },
        scripted: {
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
          evidence: {},
        },
      },
      {
        event: {
          id: 'evt_pause',
          at: '2026-08-23T10:00:01Z',
          protocolVersion: '1.1.0',
          kind: 'PAUSE',
        },
        scripted: { moves: [], evidence: {} },
      },
    ],
  };
}

describe('parseTutoringScenario', () => {
  it('parses protocol events and scripted moves at the file boundary', () => {
    const scenario = parseTutoringScenario(validScenarioInput());

    expect(scenario.steps[0]?.event.kind).toBe('ARRIVED');
    expect(scenario.steps[0]?.scripted.moves[0]?.kind).toBe('WELCOME');
  });

  it('rejects an answer oracle that does not reference an answer event', () => {
    const input = validScenarioInput();
    const invalid = {
      ...input,
      context: {
        ...input.context,
        answerOutcomes: [{ eventId: 'evt_missing', outcome: 'wrong' }],
      },
    };

    expect(() => parseTutoringScenario(invalid)).toThrow('must reference an ANSWER event');
  });
});
