import { describe, expect, it } from 'vitest';

import {
  checkTutoringInvariants,
  createScriptedTutor,
  parseTutoringScenario,
  replayScenario,
  type TutorImplementation,
  type TutoringScenario,
} from '@/testing/tutoring';

function replayScenarioFixture(): TutoringScenario {
  return parseTutoringScenario({
    id: 'replay-check',
    title: 'Replay check',
    grade: '4',
    description: 'Exercises the replay seam.',
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
          id: 'evt_interrupt',
          at: '2026-08-23T10:00:01Z',
          protocolVersion: '1.1.0',
          kind: 'INTERRUPT',
          interruptedMoveId: 'mov_welcome',
        },
        scripted: {
          moves: [],
          stopMoveIds: ['mov_welcome'],
          evidence: { approachId: 'yield' },
        },
      },
    ],
  });
}

describe('replayScenario', () => {
  it('feeds events in order and records deterministic moves, timings, and evidence', async () => {
    const scenario = replayScenarioFixture();
    const timestamps = [100, 115, 200, 230];
    const transcript = await replayScenario(scenario, createScriptedTutor(scenario), {
      now: () => timestamps.shift() ?? 230,
    });

    expect(transcript.turns.map((turn) => turn.event.id)).toEqual(['evt_arrived', 'evt_interrupt']);
    expect(transcript.turns[0]?.moves[0]?.kind).toBe('WELCOME');
    expect(transcript.turns[1]?.evidence.approachId).toBe('yield');
    expect(transcript.turns[1]?.stoppedMoveIds).toEqual(['mov_welcome']);
    expect(checkTutoringInvariants(transcript).passed).toBe(true);
    expect(transcript.turns.map((turn) => turn.durationMs)).toEqual([15, 30]);
  });

  it('fails when stopped move delivery continues after an interruption', async () => {
    const scenario = replayScenarioFixture();
    const scriptedTutor = createScriptedTutor(scenario);
    const continuedMove = scenario.steps[0]?.scripted.moves[0];
    if (continuedMove === undefined) throw new Error('Replay fixture needs a move to interrupt.');
    const tutor: TutorImplementation = {
      async handle(event, control) {
        const result = await scriptedTutor.handle(event, control);
        return event.kind === 'INTERRUPT' ? { ...result, moves: [continuedMove] } : result;
      },
    };

    const transcript = await replayScenario(scenario, tutor);

    expect(checkTutoringInvariants(transcript).passed).toBe(false);
  });
});
