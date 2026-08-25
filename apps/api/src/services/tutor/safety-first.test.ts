import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, tutorInputEventSchema } from '@aria/shared';
import type { TutorMove } from '@aria/shared';

import { detectCrisis } from '@/safety/crisis/detect';
import { turnMoves } from '@/services/tutor/safety-first';

const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000901');

const CRISIS_UTTERANCES = [
  'i want to kill myself',
  'my dad hits me when he is angry',
  'i am scared',
];
const ORDINARY_UTTERANCES = ['seven', 'i have a cat', "i don't get it", 'i want to stop'];

function answer(text: string) {
  return tutorInputEventSchema.parse({
    id: 'event-1',
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind: 'ANSWER',
    respondsTo: 'ask-1',
    text,
  });
}

const CRISIS_MOVE: TutorMove = {
  id: 'mov_crisis',
  at: '2026-08-25T10:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'SAY',
  speech: { text: 'Thank you for telling me. I am going to tell a grown-up who can help.' },
  display: [],
  expects: 'none',
};

function services(crisisFires: boolean) {
  const crisis = { handle: vi.fn(() => Promise.resolve(crisisFires ? [CRISIS_MOVE] : null)) };
  const tutor = { handle: vi.fn(() => Promise.resolve([])) };
  return { crisis, tutor };
}

describe('safety runs before intent', () => {
  it('never reaches the tutor — and so never the intent classifier — on a crisis turn', async () => {
    const fakes = services(true);

    const moves = await turnMoves(fakes, 'student-1', answer('i want to kill myself'));

    expect(moves).toEqual([CRISIS_MOVE]);
    expect(fakes.crisis.handle).toHaveBeenCalledOnce();
    expect(fakes.tutor.handle).not.toHaveBeenCalled();
  });

  it('reaches the tutor when safety found nothing', async () => {
    const fakes = services(false);

    await turnMoves(fakes, 'student-1', answer('seven'));

    expect(fakes.crisis.handle).toHaveBeenCalledOnce();
    expect(fakes.tutor.handle).toHaveBeenCalledOnce();
  });

  it('asks safety first even for an event safety will ignore', async () => {
    const fakes = services(false);
    const order: string[] = [];
    fakes.crisis.handle.mockImplementation(() => {
      order.push('crisis');
      return Promise.resolve(null);
    });
    fakes.tutor.handle.mockImplementation(() => {
      order.push('tutor');
      return Promise.resolve([]);
    });

    await turnMoves(fakes, 'student-1', answer('seven'));

    expect(order).toEqual(['crisis', 'tutor']);
  });

  it.each(CRISIS_UTTERANCES)('recognises %s as a crisis', (text) => {
    expect(detectCrisis({ text }).kind).not.toBe('none');
  });

  it.each(ORDINARY_UTTERANCES)('leaves %s for the intent classifier', (text) => {
    expect(detectCrisis({ text }).kind).toBe('none');
  });
});
