import { describe, expect, it } from 'vitest';

import { createScriptedTutor, parseTutoringScenario, replayScenario } from '@/testing/tutoring';

describe('replayScenario', () => {
  it('feeds events in order and records deterministic moves, timings, and evidence', async () => {
    const scenario = parseTutoringScenario({
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
            id: 'evt_pause',
            at: '2026-08-23T10:00:01Z',
            protocolVersion: '1.1.0',
            kind: 'PAUSE',
          },
          scripted: { moves: [], evidence: { approachId: 'pause' } },
        },
      ],
    });
    const timestamps = [100, 115, 200, 230];
    const transcript = await replayScenario(scenario, createScriptedTutor(scenario), {
      now: () => timestamps.shift() ?? 230,
    });

    expect(transcript.turns.map((turn) => turn.event.id)).toEqual(['evt_arrived', 'evt_pause']);
    expect(transcript.turns[0]?.moves[0]?.kind).toBe('WELCOME');
    expect(transcript.turns[1]?.evidence.approachId).toBe('pause');
    expect(transcript.turns.map((turn) => turn.durationMs)).toEqual([15, 30]);
  });
});
