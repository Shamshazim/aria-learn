import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '../version';

import {
  EVENT_FIXTURES,
  MOVE_FIXTURES,
  PREVIOUS_VERSION_EVENT_FIXTURE,
} from './__fixtures__/protocol.fixtures';
import { EVENT_KINDS, tutorInputEventSchema } from './events';
import { MOVE_KINDS, tutorMoveSchema } from './moves';
import { turnResponseSchema } from './session';

/**
 * The protocol is the spine of the product: the frontend renders it, the backend produces it
 * and both golden sets are written against it. These tests hold the shape still.
 */

const eventEntries = EVENT_KINDS.map((kind) => [kind, EVENT_FIXTURES[kind]] as const);
const moveEntries = MOVE_KINDS.map((kind) => [kind, MOVE_FIXTURES[kind]] as const);

describe('the event union', () => {
  it('declares the sixteen text and realtime event kinds', () => {
    expect(EVENT_KINDS).toHaveLength(16);
    expect(new Set(EVENT_KINDS).size).toBe(16);
  });

  it.each(eventEntries)('parses a valid %s', (kind, fixture) => {
    const parsed = tutorInputEventSchema.parse(fixture);
    expect(parsed.kind).toBe(kind);
    expect(parsed.protocolVersion).toBe(PROTOCOL_VERSION);
  });
});

describe('the move union', () => {
  it('declares all fourteen kinds from master-plan §4.1', () => {
    expect(MOVE_KINDS).toHaveLength(14);
    expect(new Set(MOVE_KINDS).size).toBe(14);
  });

  it.each(moveEntries)('parses a valid %s', (kind, fixture) => {
    const parsed = tutorMoveSchema.parse(fixture);
    expect(parsed.kind).toBe(kind);
  });

  it.each(moveEntries)('gives %s a speech field so Phase 2 can speak it', (_kind, fixture) => {
    const parsed = tutorMoveSchema.parse(fixture);
    expect(parsed).toHaveProperty('speech');
  });

  it.each(moveEntries)(
    'declares what %s expects back, for the UI to derive a control',
    (_kind, fixture) => {
      const parsed = tutorMoveSchema.parse(fixture);
      expect(['choice', 'text', 'number', 'speech', 'drag', 'none']).toContain(parsed.expects);
    },
  );
});

describe('round trip', () => {
  it.each(eventEntries)('%s survives parse -> serialise -> parse unchanged', (_kind, fixture) => {
    const once = tutorInputEventSchema.parse(fixture);
    const twice = tutorInputEventSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it.each(moveEntries)('%s survives parse -> serialise -> parse unchanged', (_kind, fixture) => {
    const once = tutorMoveSchema.parse(fixture);
    const twice = tutorMoveSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

describe('realtime envelope fields', () => {
  it('round-trips client ordering state on events', () => {
    const parsed = tutorInputEventSchema.parse(EVENT_FIXTURES.SPEECH_STARTED);
    const roundTripped = tutorInputEventSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(roundTripped).toMatchObject({
      turnId: 'turn_01',
      connectionEpoch: 2,
      acknowledgedSeq: 17,
    });
  });

  it('round-trips server ordering and causation state on moves', () => {
    const parsed = tutorMoveSchema.parse(MOVE_FIXTURES.SAY);
    const roundTripped = tutorMoveSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(roundTripped).toMatchObject({
      turnId: 'turn_01',
      connectionEpoch: 2,
      serverSeq: 18,
      causationId: 'evt_final',
    });
  });
});

describe('protocol compatibility', () => {
  it('bumps the current protocol minor version', () => {
    expect(PROTOCOL_VERSION).toBe('1.1.0');
  });

  it('still parses a P0-02 fixture without the optional realtime fields', () => {
    const parsed = tutorInputEventSchema.parse(PREVIOUS_VERSION_EVENT_FIXTURE);

    expect(parsed.protocolVersion).toBe('1.0.0');
    expect(parsed).not.toHaveProperty('turnId');
  });
});

describe('realtime move controls', () => {
  it('round-trips resumable audio identity and the client duck reflex', () => {
    const parsed = tutorMoveSchema.parse(MOVE_FIXTURES.SAY);
    const roundTripped = tutorMoveSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(roundTripped).toMatchObject({
      resumeOf: 'mov_interrupted',
      generationId: 'gen_01',
      reflexes: { duckOnSpeech: true },
      speech: { assetId: 'speech_ready_01' },
    });
  });

  it('round-trips bounded vocabulary hints on ASK', () => {
    const parsed = tutorMoveSchema.parse(MOVE_FIXTURES.ASK);

    expect(parsed).toMatchObject({ vocabularyHint: ['quarters', 'whole'] });
  });

  it('rejects vocabulary hints on LISTEN so a passage cannot bias reading ASR', () => {
    const result = tutorMoveSchema.safeParse({
      ...(MOVE_FIXTURES.LISTEN as Record<string, unknown>),
      vocabularyHint: ['The', 'cat', 'sat', 'on', 'the', 'mat'],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['vocabularyHint']);
  });

  it('rejects a client reflex that can cancel speech', () => {
    const result = tutorMoveSchema.safeParse({
      ...(MOVE_FIXTURES.SAY as Record<string, unknown>),
      reflexes: { duckOnSpeech: true, stopOnSpeech: true },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['reflexes']);
  });
});

describe('rejection', () => {
  it('fails an unknown event kind with an error naming the discriminator', () => {
    const result = tutorInputEventSchema.safeParse({
      ...(EVENT_FIXTURES.PAUSE as Record<string, unknown>),
      kind: 'TELEPATHY',
    });

    expect(result.success).toBe(false);

    // Readable means it points at the field and lists what would have been accepted.
    const issue = result.error?.issues[0];
    expect(issue?.path).toEqual(['kind']);
    expect(issue?.message).toContain('discriminator');
    expect(issue?.message).toContain('ARRIVED');
  });

  it('fails an unknown move kind', () => {
    const result = tutorMoveSchema.safeParse({
      ...(MOVE_FIXTURES.SAY as Record<string, unknown>),
      kind: 'SHOUT',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['kind']);
  });

  it('rejects a timestamp carrying an offset, so every `at` is comparable', () => {
    const result = tutorInputEventSchema.safeParse({
      ...(EVENT_FIXTURES.PAUSE as Record<string, unknown>),
      at: '2026-08-22T10:00:00+05:30',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an ANSWER that carries neither a choice nor text', () => {
    const { choiceId: _choiceId, ...withoutChoice } = EVENT_FIXTURES.ANSWER as Record<
      string,
      unknown
    >;

    expect(tutorInputEventSchema.safeParse(withoutChoice).success).toBe(false);
  });

  it('rejects a protocol version it does not speak', () => {
    const result = tutorInputEventSchema.safeParse({
      ...(EVENT_FIXTURES.PAUSE as Record<string, unknown>),
      protocolVersion: '0.9.0',
    });

    expect(result.success).toBe(false);
  });
});

describe('the turn envelope', () => {
  it('carries at least one move and echoes the event it answers', () => {
    const response = turnResponseSchema.parse({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: 'ses_01',
      inResponseTo: 'evt_answer',
      at: '2026-08-22T10:00:01Z',
      moves: [MOVE_FIXTURES.PRAISE, MOVE_FIXTURES.ASK],
    });

    expect(response.moves).toHaveLength(2);
    expect(response.inResponseTo).toBe('evt_answer');
  });

  it('rejects a turn that produced no moves', () => {
    const result = turnResponseSchema.safeParse({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: 'ses_01',
      inResponseTo: 'evt_answer',
      at: '2026-08-22T10:00:01Z',
      moves: [],
    });

    expect(result.success).toBe(false);
  });
});
