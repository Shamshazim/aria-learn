import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema } from '@aria/shared';

import { engagementContext, ENGAGEMENT_EVENT_KIND } from '@/services/tutor/engagement-context';
import type { SessionEventRecord } from '@/types/session';

const T0 = new Date('2026-11-10T20:00:00.000Z');
let seq = 0;

function at(seconds: number): Date {
  return new Date(T0.getTime() + seconds * 1000);
}

function record(
  fields: Partial<SessionEventRecord> & Pick<SessionEventRecord, 'actor' | 'kind'>,
): SessionEventRecord {
  seq += 1;
  return {
    id: `record-${String(seq)}`,
    sessionId: 'session-1',
    seq,
    at: at(seq),
    text: null,
    skillCode: 'ADD.FACT.10',
    correct: null,
    latencyMs: null,
    evidence: {},
    payload: {},
    ...fields,
  };
}

function ask(id: string, answerKey: string | null, itemId = 'item-1'): SessionEventRecord {
  return record({
    actor: 'aria',
    kind: 'ASK',
    evidence: answerKey === null ? {} : { answerKey },
    payload: {
      id,
      at: T0.toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      kind: 'ASK',
      speech: { text: 'What is 3 + 4?' },
      display: [],
      expects: 'number',
      skillId: 'ADD.FACT.10',
      itemId,
      attempt: 1,
    },
  });
}

function answer(
  respondsTo: string,
  correct: boolean,
  elapsedMs: number,
  text = '5',
): SessionEventRecord {
  return record({
    actor: 'child',
    kind: 'ANSWER',
    text,
    correct,
    latencyMs: elapsedMs,
    payload: {
      id: `answer-${String(seq)}`,
      at: at(seq + 1).toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      kind: 'ANSWER',
      respondsTo,
      text,
      elapsedMs,
    },
  });
}

function answerTo(respondsTo: string) {
  return tutorInputEventSchema.parse({
    id: 'event-next',
    at: at(100).toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'ANSWER',
    respondsTo,
    text: '7',
  });
}

const NEXT = answerTo('ask-1');

describe('engagement read back from the session log', () => {
  it('derives slow answers, a wrong-answer run, statements and client signals', () => {
    const records = [
      ask('ask-1', '7'),
      answer('ask-1', false, 30_000),
      answer('ask-1', false, 2_000),
      answer('ask-1', false, 2_000, "I'm so tired"),
      record({
        actor: 'child',
        kind: 'ENGAGEMENT_SIGNAL',
        payload: {
          id: 'sig-1',
          at: at(20).toISOString(),
          protocolVersion: PROTOCOL_VERSION,
          kind: 'ENGAGEMENT_SIGNAL',
          signal: 'idle',
          hiddenMs: 40_000,
        },
      }),
    ];
    const names = engagementContext(records, NEXT, 'early').signals.map((signal) => signal.name);
    expect(names).toEqual(['latency_slow', 'said_tired', 'errors_repeated', 'idle']);
  });

  it('reads what was already done, the last state, and a check-in still waiting', () => {
    const checkIn = record({
      actor: 'aria',
      kind: 'CHECK_IN',
      evidence: { engagementCheckIn: 'disengaged' },
      payload: {
        id: 'check-1',
        at: T0.toISOString(),
        protocolVersion: PROTOCOL_VERSION,
        kind: 'CHECK_IN',
        speech: { text: 'Keep going?' },
        display: [],
        expects: 'choice',
        about: 'preference',
      },
    });
    const records = [
      record({
        actor: 'system',
        kind: ENGAGEMENT_EVENT_KIND,
        evidence: {
          engagementState: 'tired',
          engagementConfidence: 0.9,
          engagementDecision: 'offer_break',
        },
      }),
      record({
        actor: 'system',
        kind: ENGAGEMENT_EVENT_KIND,
        evidence: {
          engagementState: 'ready',
          engagementConfidence: 0,
          engagementDecision: 'reply_keep',
          engagementDenied: 'frustrated',
        },
      }),
      record({
        actor: 'system',
        kind: ENGAGEMENT_EVENT_KIND,
        evidence: {
          engagementState: 'disengaged',
          engagementConfidence: 0.4,
          engagementDecision: 'check_in',
        },
      }),
      checkIn,
    ];
    const context = engagementContext(records, NEXT, 'middle');
    expect(context.history).toEqual({
      checkedIn: ['disengaged'],
      adapted: ['tired'],
      escalated: [],
      denied: ['frustrated'],
    });
    expect(context.previous).toEqual({ kind: 'disengaged', confidence: 0.4 });
    expect(context.openCheckIn).toEqual({ state: 'disengaged', moveId: 'check-1' });
    expect(context.signals.map((signal) => signal.name)).toEqual(['said_fine']);
    expect(
      engagementContext([...records, answer('check-1', false, 1_000, 'keep')], NEXT, 'middle')
        .openCheckIn,
    ).toBeNull();
  });

  it('knows whether the answered question was open and what it expected', () => {
    expect(engagementContext([ask('ask-1', '7')], NEXT, 'early').current).toEqual({
      expects: 'number',
      openQuestion: false,
    });
    expect(engagementContext([ask('ask-1', null)], NEXT, 'early').current).toEqual({
      expects: 'number',
      openQuestion: true,
    });
  });

  it('reads a re-asked item as the question it is, not an open one', () => {
    const records = [ask('ask-1', '7'), ask('ask-2', null)];
    expect(engagementContext(records, answerTo('ask-2'), 'early').current).toEqual({
      expects: 'number',
      openQuestion: false,
    });
    const fresh = [ask('ask-1', '7'), ask('ask-3', null, 'item-2')];
    expect(engagementContext(fresh, answerTo('ask-3'), 'early').current).toEqual({
      expects: 'number',
      openQuestion: true,
    });
  });
});
