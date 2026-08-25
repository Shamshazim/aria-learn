import { describe, expect, it } from 'vitest';

import type { TutorMove } from '@aria/shared';
import { silenceWindowMs } from '@aria/tutor';

import { createEventFactory } from '@/features/session/model/input-events';
import { reduceSession } from '@/features/session/model/session-machine';
import { initialSessionState } from '@/features/session/model/session-state';
import { createScriptedSource } from '@/features/session/sources/scripted-source';

describe('session reducer', () => {
  it('reduces all fourteen move kinds without losing their ordered history', async () => {
    const moves = await allMoves();
    const finalState = moves.reduce(reduceSession, initialSessionState('middle'));

    expect(new Set(finalState.moves.map((move) => move.kind)).size).toBe(14);
    expect(finalState.currentMove?.kind).toBe('END');
    expect(finalState.ended).toBe(true);
    expect(finalState.paused).toBe(true);
  });

  it('stops the active move without leaving orphaned state', async () => {
    const active = (await allMoves()).find((move) => move.kind === 'SAY');
    expect(active).toBeDefined();
    if (active === undefined) return;
    const speaking = reduceSession(initialSessionState('early'), active);
    const stopped = reduceSession(speaking, { kind: 'STOP_ACTIVE' });

    expect(stopped.currentMove).toBeNull();
    expect(stopped.stoppedMoveIds).toEqual([active.id]);
    expect(reduceSession(stopped, { kind: 'STOP_ACTIVE' })).toBe(stopped);
  });

  it('shows pending work and settles an empty response', async () => {
    const active = (await allMoves()).find((move) => move.kind === 'SAY');
    expect(active).toBeDefined();
    if (active === undefined) return;
    const speaking = reduceSession(initialSessionState('early'), active);
    const pending = reduceSession(speaking, { kind: 'SOURCE_PENDING' });
    const settled = reduceSession(pending, { kind: 'SOURCE_SETTLED' });

    expect(pending.status).toBe('thinking');
    expect(settled.status).toBe('waiting');
    expect(reduceSession(speaking, { kind: 'SOURCE_SETTLED' })).toBe(speaking);
  });

  it('waits when a move deliberately has no speech', async () => {
    const active = (await allMoves()).find((move) => move.kind === 'SAY');
    expect(active).toBeDefined();
    if (active === undefined) return;

    const silent = reduceSession(initialSessionState('middle'), { ...active, speech: null });

    expect(silent.status).toBe('waiting');
  });

  it('uses a longer silence window as learners get older', () => {
    expect((['early', 'middle', 'senior'] as const).map(silenceWindowMs)).toEqual([
      12_000, 18_000, 25_000,
    ]);
  });
});

async function allMoves(): Promise<readonly TutorMove[]> {
  const source = createScriptedSource();
  let sequence = 0;
  const make = createEventFactory({
    nextId: () => `machine-event-${String(++sequence)}`,
    now: () => new Date('2026-08-24T12:00:00Z'),
  });
  const payloads = [
    { kind: 'ARRIVED', grade: '4' },
    { kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false },
    { kind: 'ANSWER', respondsTo: 'ask-1', text: '6' },
    { kind: 'ANSWER', respondsTo: 'ask-2', text: '6' },
    { kind: 'ANSWER', respondsTo: 'ask-3', text: '7' },
    { kind: 'QUESTION', text: 'Why?' },
    { kind: 'CONFUSED' },
    { kind: 'SPEECH_FINAL', text: 'seven' },
    { kind: 'SILENCE', waitedMs: 18_000 },
    { kind: 'INTERRUPT' },
    { kind: 'MEDIA_RESTORED' },
    { kind: 'PAUSE' },
    { kind: 'RESUME' },
    { kind: 'LEAVE', reason: 'done' },
  ] as const;
  const moves: TutorMove[] = [];
  for (const payload of payloads) {
    for await (const move of source.send(make(payload))) moves.push(move);
  }
  source.close();
  return moves;
}
