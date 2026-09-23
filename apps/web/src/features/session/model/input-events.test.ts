import { describe, expect, it } from 'vitest';

import { EVENT_KINDS } from '@aria/shared';

import { createEventFactory, type EventPayload } from '@/features/session/model/input-events';

const PAYLOADS: readonly EventPayload[] = [
  { kind: 'ARRIVED', grade: '4' },
  { kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false },
  { kind: 'ANSWER', respondsTo: 'ask-1', text: '7' },
  { kind: 'QUESTION', text: 'Why?' },
  { kind: 'CONFUSED', aboutMoveId: 'ask-1' },
  { kind: 'SKIP', respondsTo: 'ask-1', reason: 'child_asked' },
  { kind: 'SPEECH_PARTIAL', text: 'sev' },
  { kind: 'SPEECH_FINAL', text: 'seven' },
  { kind: 'SILENCE', waitedMs: 18_000, afterMoveId: 'ask-1' },
  { kind: 'INTERRUPT', interruptedMoveId: 'say-1' },
  { kind: 'BACKCHANNEL' },
  { kind: 'SPEECH_STARTED' },
  { kind: 'MEDIA_LOST' },
  { kind: 'MEDIA_RESTORED' },
  { kind: 'PAUSE' },
  { kind: 'RESUME' },
  { kind: 'LEAVE', reason: 'done' },
];

describe('input event factory', () => {
  it('produces every current protocol event with a valid envelope', () => {
    let sequence = 0;
    const make = createEventFactory({
      nextId: () => `event-${String(++sequence)}`,
      now: () => new Date('2026-08-24T12:00:00Z'),
    });
    const events = PAYLOADS.map(make);

    expect(events.map((event) => event.kind)).toEqual(EVENT_KINDS);
    expect(events.every((event) => event.at === '2026-08-24T12:00:00.000Z')).toBe(true);
    expect(new Set(events.map((event) => event.id)).size).toBe(EVENT_KINDS.length);
  });
});
