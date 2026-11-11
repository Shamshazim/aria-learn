import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '../version';

import { EVENT_FIXTURES } from './__fixtures__/protocol.fixtures';
import { tutorInputEventSchema, type EventKind } from './events';
import { engagementRequestSchema, engagementResponseSchema, turnRequestSchema } from './session';

/** P3-05: the engagement signal, and the 1.2.0 version window it opened. */
const eventOf = (kind: EventKind) => EVENT_FIXTURES[kind] as Record<string, unknown>;

describe('engagement signals (P3-05)', () => {
  it('closes the window on the version before the previous one (1.2.0 keeps only 1.1.0)', () => {
    const result = tutorInputEventSchema.safeParse({
      ...eventOf('PAUSE'),
      protocolVersion: '1.0.0',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a client engagement signal and refuses one a client may not send (P3-05)', () => {
    const idle = {
      ...eventOf('PAUSE'),
      kind: 'ENGAGEMENT_SIGNAL',
      signal: 'idle',
      hiddenMs: 31_000,
    };
    expect(tutorInputEventSchema.safeParse(idle).success).toBe(true);
    const claimed = { ...eventOf('PAUSE'), kind: 'ENGAGEMENT_SIGNAL', signal: 'said_tired' };
    expect(tutorInputEventSchema.safeParse(claimed).success).toBe(false);
  });

  it('sends engagement signals to their own exchange, which may answer with nothing (P3-05)', () => {
    const event = {
      ...eventOf('PAUSE'),
      kind: 'ENGAGEMENT_SIGNAL',
      signal: 'idle',
      sessionId: 'ses_01',
    };
    expect(
      turnRequestSchema.safeParse({ protocolVersion: PROTOCOL_VERSION, sessionId: 'ses_01', event })
        .success,
    ).toBe(false);
    expect(
      engagementRequestSchema.safeParse({
        protocolVersion: PROTOCOL_VERSION,
        sessionId: 'ses_01',
        event,
      }).success,
    ).toBe(true);
    const quiet = engagementResponseSchema.safeParse({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: 'ses_01',
      inResponseTo: 'evt_engagement',
      at: '2026-08-22T10:00:01Z',
      moves: [],
    });
    expect(quiet.success).toBe(true);
  });
});
