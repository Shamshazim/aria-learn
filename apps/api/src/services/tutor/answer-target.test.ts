import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, tutorMoveSchema, type TutorMove } from '@aria/shared';

import {
  askRecords,
  createAnswerResync,
  movesSince,
  questionEvidence,
  resolveAnswerTarget,
} from '@/services/tutor/answer-target';
import type { SessionEventRecord } from '@/types/session';

const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000902');

function ask(id: string, itemId: string): TutorMove {
  return tutorMoveSchema.parse({
    id,
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind: 'ASK',
    skillId: 'add-within-10',
    itemId,
    attempt: 1,
    speech: { text: 'What is three and four?' },
    display: [{ type: 'text', body: 'What is 3 + 4?', markdown: false }],
    expects: 'text',
  });
}

function hint(id: string): TutorMove {
  return tutorMoveSchema.parse({
    id,
    at: '2026-08-25T10:00:10.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind: 'HINT',
    speech: { text: 'Count on from three.' },
    display: [],
    expects: 'none',
  });
}

function record(
  seq: number,
  move: TutorMove,
  evidence: Readonly<Record<string, unknown>> = {},
): SessionEventRecord {
  return {
    id: `event-${String(seq)}`,
    sessionId: SESSION_ID,
    seq,
    at: new Date('2026-08-25T10:00:00.000Z'),
    actor: 'aria',
    kind: move.kind,
    text: move.speech?.text ?? null,
    skillCode: null,
    correct: null,
    latencyMs: null,
    evidence,
    payload: move,
  };
}

function asAsk(entry: SessionEventRecord) {
  const parsed = askRecords([entry])[0];
  if (parsed === undefined) throw new Error('not an ASK record');
  return parsed;
}

const FIRST_ASK = record(1, ask('ask-1', 'item-a'), { answerKey: '7' });
const HINT = record(2, hint('hint-2'), { approach: 'single-nudge' });
const RE_ASK = record(3, ask('ask-3', 'item-a'), { approach: 'single-nudge' });
const NEXT_ASK = record(4, ask('ask-4', 'item-b'), { answerKey: '9' });

describe('which question an answer is for', () => {
  it('is the current question when the ids match', () => {
    expect(resolveAnswerTarget([FIRST_ASK, HINT, RE_ASK], 'ask-3')).toEqual({
      kind: 'current',
      ask: asAsk(RE_ASK),
    });
  });

  it('is the current asking when the child answers an earlier asking of the same item', () => {
    expect(resolveAnswerTarget([FIRST_ASK, HINT, RE_ASK], 'ask-1')).toEqual({
      kind: 'reasked',
      ask: asAsk(RE_ASK),
    });
  });

  it('is stale when Aria has moved on to another item', () => {
    expect(resolveAnswerTarget([FIRST_ASK, HINT, RE_ASK, NEXT_ASK], 'ask-1')).toEqual({
      kind: 'stale',
      latest: asAsk(NEXT_ASK),
    });
  });

  it('is stale when the move was never asked here', () => {
    expect(resolveAnswerTarget([FIRST_ASK], 'ask-from-last-week')).toMatchObject({
      kind: 'stale',
    });
    expect(resolveAnswerTarget([], 'ask-1')).toEqual({ kind: 'stale', latest: null });
  });
});

describe('the evidence for a re-asked question', () => {
  it('keeps the answer key from the first asking', () => {
    expect(questionEvidence([FIRST_ASK, HINT, RE_ASK], asAsk(RE_ASK))).toEqual({
      answerKey: '7',
      approach: 'single-nudge',
    });
  });

  it('does not borrow from a different item', () => {
    expect(questionEvidence([FIRST_ASK, NEXT_ASK], asAsk(NEXT_ASK))).toEqual({ answerKey: '9' });
  });
});

describe('re-syncing a stale answer', () => {
  it('lets a gradable answer through', async () => {
    const resync = createAnswerResync(
      { list: () => Promise.resolve([FIRST_ASK, HINT, RE_ASK]) },
      {
        info: vi.fn(),
      },
    );

    await expect(resync({ sessionId: SESSION_ID, respondsTo: 'ask-1' })).resolves.toBeNull();
    await expect(resync({ sessionId: SESSION_ID, respondsTo: 'ask-3' })).resolves.toBeNull();
  });

  it('answers a stale one with the moves the client has fallen behind, and logs it', async () => {
    const info = vi.fn();
    const records = [FIRST_ASK, HINT, RE_ASK, NEXT_ASK];
    const resync = createAnswerResync({ list: () => Promise.resolve(records) }, { info });

    const moves = await resync({ sessionId: SESSION_ID, respondsTo: 'ask-1' });

    expect(moves).toEqual(movesSince(records, asAsk(NEXT_ASK)));
    expect(moves?.map((move) => move.id)).toEqual(['ask-4']);
    expect(info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        event: 'stale_answer',
        respondsTo: 'ask-1',
        currentMoveId: 'ask-4',
      }),
      expect.any(String),
    );
  });

  it('has nothing to re-send before the first question, so the turn is validated instead', async () => {
    const resync = createAnswerResync({ list: () => Promise.resolve([]) }, { info: vi.fn() });

    await expect(resync({ sessionId: SESSION_ID, respondsTo: 'ask-1' })).resolves.toBeNull();
  });
});
