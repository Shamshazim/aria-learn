import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, tutorInputEventSchema } from '@aria/shared';

import { isStaleSilence } from '@/services/tutor/stale-silence';

const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000901');

function silence(afterMoveId?: string) {
  return tutorInputEventSchema.parse({
    id: 'event-1',
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind: 'SILENCE',
    waitedMs: 12_000,
    ...(afterMoveId === undefined ? {} : { afterMoveId }),
  });
}

function logger() {
  return { info: vi.fn() };
}

describe('stale SILENCE', () => {
  it('is ignored and logged when Aria has already moved on', async () => {
    const log = logger();

    const stale = await isStaleSilence(silence('ask-1'), () => Promise.resolve('praise-2'), log);

    expect(stale).toBe(true);
    expect(log.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        event: 'stale_silence',
        afterMoveId: 'ask-1',
        currentMoveId: 'praise-2',
      }),
      expect.any(String),
    );
  });

  it('is acted on when it names the move the child is still looking at', async () => {
    const log = logger();

    expect(await isStaleSilence(silence('ask-1'), () => Promise.resolve('ask-1'), log)).toBe(false);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('is acted on when the client did not anchor it to a move', async () => {
    expect(await isStaleSilence(silence(), () => Promise.resolve('ask-1'), logger())).toBe(false);
  });

  it('is acted on when the session has no move yet', async () => {
    expect(await isStaleSilence(silence('ask-1'), () => Promise.resolve(null), logger())).toBe(
      false,
    );
  });

  it('never rejects an event that is not a silence', async () => {
    const answer = tutorInputEventSchema.parse({
      id: 'event-2',
      at: '2026-08-25T10:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      kind: 'ANSWER',
      respondsTo: 'ask-1',
      text: '7',
    });

    expect(await isStaleSilence(answer, () => Promise.resolve('praise-2'), logger())).toBe(false);
  });
});
