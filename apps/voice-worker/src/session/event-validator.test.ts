import { describe, expect, it, vi } from 'vitest';

import { createEventValidator, type EventValidator } from '@/session/event-validator';

/**
 * X-05: "the worker drops malformed events, counts them, and disconnects after the threshold;
 * a valid session continues unaffected."
 *
 * The last clause is the one worth writing tests for. Dropping rubbish is easy; dropping it
 * without ending a session a five-year-old is in the middle of is the requirement.
 */
const encoder = new TextEncoder();

function bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

function frame(event: Readonly<Record<string, unknown>>): Uint8Array {
  return bytes(JSON.stringify(event));
}

const ACK = { kind: 'ACK', acknowledgedSeq: 3 } as const;

function build(
  overrides: Partial<Parameters<typeof createEventValidator>[0]> = {},
): Readonly<{ events: EventValidator; onAbuse: ReturnType<typeof vi.fn> }> {
  const onAbuse = vi.fn();
  return { onAbuse, events: createEventValidator({ onAbuse, now: () => 0, ...overrides }) };
}

describe('the data-channel gate', () => {
  it('passes an event the schema recognises', () => {
    expect(build().events.accept(frame(ACK))).toEqual(ACK);
  });

  it.each([
    ['not JSON at all', bytes('{"kind": '), 'not-json'],
    ['JSON that is not an object', bytes('"ACK"'), 'not-an-event'],
    ['the literal null', bytes('null'), 'not-an-event'],
    ['an unknown kind', frame({ kind: 'DROP_TABLES' }), 'not-an-event'],
    ['a known kind with the wrong payload', frame({ kind: 'ACK' }), 'not-an-event'],
    ['a field nobody declared', frame({ ...ACK, andAlso: 'this' }), 'not-an-event'],
    [
      'a sequence that is not a number',
      frame({ kind: 'ACK', acknowledgedSeq: '3' }),
      'not-an-event',
    ],
  ])('drops and counts %s', (_name, payload, reason) => {
    const { events } = build();

    expect(events.accept(payload)).toBeNull();
    expect(events.counts().rejected[reason as 'not-json']).toBe(1);
  });

  /** Oversized is refused before `JSON.parse`, so a huge frame is never decoded. */
  it('drops a frame larger than the ceiling without parsing it', () => {
    const { events } = build({ maxPayloadBytes: 64 });

    expect(events.accept(frame({ kind: 'SCREEN_ANSWER', moveId: 'm', text: 'x'.repeat(200) })));
    expect(events.counts().rejected.oversized).toBe(1);
  });

  it('leaves a session that is merely noisy alone', () => {
    const { events, onAbuse } = build({ maxInvalid: 5 });

    for (let i = 0; i < 4; i += 1) events.accept(bytes('nonsense'));

    expect(onAbuse).not.toHaveBeenCalled();
    expect(events.accept(frame(ACK))).toEqual(ACK);
    expect(events.isClosed()).toBe(false);
  });

  it('ends the session once the window fills, and only once', () => {
    const { events, onAbuse } = build({ maxInvalid: 3 });

    for (let i = 0; i < 10; i += 1) events.accept(bytes('nonsense'));

    expect(onAbuse).toHaveBeenCalledTimes(1);
    expect(onAbuse).toHaveBeenCalledWith({ rejected: 3, withinMs: 10_000 });
    expect(events.isClosed()).toBe(true);
  });

  it('refuses everything after that, rather than delivering a late valid frame', () => {
    const { events } = build({ maxInvalid: 1 });

    events.accept(bytes('nonsense'));

    expect(events.accept(frame(ACK))).toBeNull();
    expect(events.counts().accepted).toBe(0);
  });

  /**
   * The window is what separates a broken client from a long session that saw a few bad
   * frames. Without it, one bad frame an hour would eventually end a child's session.
   */
  it('forgets rejections that fall out of the window', () => {
    let clock = 0;
    const { events, onAbuse } = build({ maxInvalid: 3, windowMs: 1_000, now: () => clock });

    for (let i = 0; i < 10; i += 1) {
      events.accept(bytes('nonsense'));
      clock += 2_000;
    }

    expect(onAbuse).not.toHaveBeenCalled();
    expect(events.counts().rejected['not-json']).toBe(10);
  });
});
