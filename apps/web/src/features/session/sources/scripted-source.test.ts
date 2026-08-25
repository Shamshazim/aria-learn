import { describe, expect, it } from 'vitest';

import { EVENT_KINDS, MOVE_KINDS, type TutorInputEvent, type TutorMove } from '@aria/shared';

import { createEventFactory, type EventPayload } from '@/features/session/model/input-events';
import { isTutorMove } from '@/features/session/model/tutor-source';
import { createScriptedSource } from '@/features/session/sources/scripted-source';

const EVENTS: readonly EventPayload[] = [
  { kind: 'ARRIVED', grade: '4' },
  { kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false },
  { kind: 'ANSWER', respondsTo: 'ask-1', text: '6' },
  { kind: 'ANSWER', respondsTo: 'ask-2', text: '6' },
  { kind: 'ANSWER', respondsTo: 'ask-3', text: '7' },
  { kind: 'QUESTION', text: 'Why?' },
  { kind: 'CONFUSED', aboutMoveId: 'ask-2' },
  { kind: 'SPEECH_PARTIAL', text: 'sev' },
  { kind: 'SPEECH_FINAL', text: 'seven' },
  { kind: 'SILENCE', waitedMs: 18_000, afterMoveId: 'ask-2' },
  { kind: 'INTERRUPT', interruptedMoveId: 'say-1' },
  { kind: 'BACKCHANNEL' },
  { kind: 'SPEECH_STARTED' },
  { kind: 'MEDIA_LOST' },
  { kind: 'MEDIA_RESTORED' },
  { kind: 'PAUSE' },
  { kind: 'RESUME' },
  { kind: 'LEAVE', reason: 'done' },
];

describe('scripted tutor source', () => {
  it('accepts every event and emits every move used by the protocol', async () => {
    const moves = await play(EVENTS);

    expect(new Set(EVENTS.map((event) => event.kind))).toEqual(new Set(EVENT_KINDS));
    expect(new Set(moves.map((move) => move.kind))).toEqual(new Set(MOVE_KINDS));
    expect(moves.find((move) => move.kind === 'WELCOME')).toMatchObject({
      basedOn: ['prior-session-1'],
    });
  });

  it('cancels the rest of a multi-move response when interrupted', async () => {
    const source = createScriptedSource();
    const controller = new AbortController();
    const seen: TutorMove[] = [];

    for await (const move of source.send(
      eventFactory()({ kind: 'ARRIVED', grade: '4' }),
      controller.signal,
    )) {
      if (isTutorMove(move)) seen.push(move);
      controller.abort();
    }

    expect(seen.map((move) => move.kind)).toEqual(['WELCOME']);
    source.close();
  });
});

async function play(payloads: readonly EventPayload[]): Promise<readonly TutorMove[]> {
  const source = createScriptedSource();
  const make = eventFactory();
  const moves: TutorMove[] = [];
  for (const payload of payloads) {
    for await (const output of source.send(make(payload))) {
      if (isTutorMove(output)) moves.push(output);
    }
  }
  source.close();
  return moves;
}

function eventFactory(): (payload: EventPayload) => TutorInputEvent {
  let sequence = 0;
  return createEventFactory({
    nextId: () => `test-event-${String(++sequence)}`,
    now: () => new Date('2026-08-24T12:00:00Z'),
  });
}
