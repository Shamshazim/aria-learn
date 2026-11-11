import { describe, expect, it } from 'vitest';

import { adapt } from './adaptation';
import { fold } from './estimator';
import { eventSignals } from './event-signals';
import { statementSignal } from './statements';
import { EMPTY_HISTORY, type EngagementSignal, type EngagementSignalName } from './types';

const NOW = new Date('2026-11-10T20:10:00.000Z');

function at(secondsAgo: number): Date {
  return new Date(NOW.getTime() - secondsAgo * 1000);
}

function signal(name: EngagementSignalName, secondsAgo = 10): EngagementSignal {
  return { name, at: at(secondsAgo) };
}

describe('the engagement estimator', () => {
  it.each([
    ['uncertain', ['latency_slow', 'latency_slow']],
    ['frustrated', ['errors_repeated', 'latency_slow', 'errors_repeated']],
    ['disengaged', ['idle']],
    ['disengaged', ['short_answers', 'tab_hidden']],
    ['tired', ['said_tired']],
    ['frustrated', ['said_frustrated']],
    ['disengaged', ['said_bored']],
    ['tired', ['stop_request']],
  ] as const)('reaches %s from %j', (kind, names) => {
    const state = fold({ signals: names.map((name, index) => signal(name, 60 - index)), now: NOW });
    expect(state.kind).toBe(kind);
    expect(state.confidence).toBeGreaterThan(0);
  });

  it('reads nothing into nothing', () => {
    expect(fold({ signals: [], now: NOW })).toMatchObject({ kind: 'ready', confidence: 0 });
  });

  it.each([
    'latency_slow',
    'errors_repeated',
    'silence',
    'short_answers',
    'tab_hidden',
    'idle',
  ] as const)('never lets one %s exceed 0.4', (name) => {
    expect(fold({ signals: [signal(name)], now: NOW }).confidence).toBeLessThanOrEqual(0.4);
  });

  it('weighs agreement by count: two 0.6, three 0.8, a statement 0.9', () => {
    const slow = (count: number) =>
      fold({
        signals: Array.from({ length: count }, (_, index) => signal('latency_slow', 30 + index)),
        now: NOW,
      });
    expect(slow(2).confidence).toBe(0.6);
    expect(slow(3).confidence).toBe(0.8);
    expect(fold({ signals: [signal('said_tired')], now: NOW }).confidence).toBe(0.9);
  });

  it('subtracts for contradicting evidence, and a good answer settles "uncertain"', () => {
    const frustrated = [signal('errors_repeated', 90), signal('tab_hidden', 80)];
    expect(fold({ signals: frustrated, now: NOW }).confidence).toBe(0.3);
    const settled = [
      signal('latency_slow', 90),
      signal('latency_slow', 80),
      signal('answered_well', 5),
    ];
    expect(fold({ signals: settled, now: NOW }).kind).toBe('ready');
    const tired = [signal('said_tired', 90), signal('answered_well', 5)];
    expect(fold({ signals: tired, now: NOW })).toMatchObject({ kind: 'tired', confidence: 0.7 });
  });

  it('expires a state five minutes after its last supporting signal', () => {
    const old = fold({ signals: [signal('said_tired', 5 * 60 + 1)], now: NOW });
    expect(old.kind).toBe('ready');
    const fresh = fold({ signals: [signal('said_tired', 60)], now: NOW });
    expect(fresh.expiresAt?.toISOString()).toBe('2026-11-10T20:14:00.000Z');
  });

  it('lets the latest of two statements win, and "I\'m fine" clear what came before', () => {
    const latest = [signal('said_tired', 50), signal('said_bored', 20)];
    expect(fold({ signals: latest, now: NOW }).kind).toBe('disengaged');
    const cleared = [signal('said_tired', 50), signal('said_fine', 20)];
    expect(fold({ signals: cleared, now: NOW }).kind).toBe('ready');
  });

  it('is order-insensitive within the window (a reconnect delivers out of order)', () => {
    const ordered = [signal('said_tired', 50), signal('said_bored', 20)];
    const shuffled = [ordered[1], ordered[0]].filter((item) => item !== undefined);
    expect(fold({ signals: shuffled, now: NOW })).toEqual(fold({ signals: ordered, now: NOW }));
  });

  it('never infers a state the child denied this session', () => {
    expect(fold({ signals: [signal('said_tired')], now: NOW, denied: ['tired'] }).kind).toBe(
      'ready',
    );
  });
});

describe('adaptation', () => {
  const tired = fold({ signals: [signal('said_tired')], now: NOW });
  const unsure = fold({ signals: [signal('idle')], now: NOW });

  it('asks below 0.7, once per state', () => {
    expect(adapt(unsure, EMPTY_HISTORY).kind).toBe('check_in');
    expect(adapt(unsure, { ...EMPTY_HISTORY, checkedIn: ['disengaged'] }).kind).toBe('none');
  });

  it('acts at 0.7 or more once, escalates a second hit to a break, then stops', () => {
    const frustrated = fold({ signals: [signal('said_frustrated')], now: NOW });
    expect(adapt(frustrated, EMPTY_HISTORY).kind).toBe('shorten');
    const again = adapt(frustrated, { ...EMPTY_HISTORY, adapted: ['frustrated'] });
    expect(again).toMatchObject({ kind: 'offer_break', escalated: true });
    const third = { ...EMPTY_HISTORY, adapted: ['frustrated'], escalated: ['frustrated'] } as const;
    expect(adapt(frustrated, third).kind).toBe('none');
    expect(adapt(tired, EMPTY_HISTORY).kind).toBe('offer_break');
  });

  it('says nothing about a single weak signal or a denied state', () => {
    expect(adapt(fold({ signals: [signal('tab_hidden')], now: NOW }), EMPTY_HISTORY).kind).toBe(
      'none',
    );
    expect(adapt(unsure, { ...EMPTY_HISTORY, denied: ['disengaged'] }).kind).toBe('none');
  });
});

describe('what the child said about themselves', () => {
  it.each([
    ["I'm tired", 'said_tired'],
    ['i am so sleepy', 'said_tired'],
    ['this is boring', 'said_bored'],
    ["I'm really frustrated", 'said_frustrated'],
    ['i hate this', 'said_frustrated'],
    ["I'm not tired", 'said_fine'],
    ["I'm fine", 'said_fine'],
  ] as const)('reads %j as %s', (text, name) => {
    expect(statementSignal(text, NOW)?.name).toBe(name);
  });

  it.each(['The tired dog slept.', 'seven', 'a boring old box'])(
    'reads nothing about the child in %j',
    (text) => {
      expect(statementSignal(text, NOW)).toBeNull();
    },
  );
});

describe('passive signals from one event', () => {
  const base = { id: 'e1', at: NOW.toISOString(), protocolVersion: '1.2.0' } as const;

  it('ignores a hidden tab under three seconds and calls thirty seconds idle', () => {
    const hidden = (hiddenMs: number) =>
      eventSignals(
        { ...base, kind: 'ENGAGEMENT_SIGNAL', signal: 'tab_hidden', hiddenMs },
        {
          band: 'early',
          expects: null,
          openQuestion: false,
        },
      ).map((item) => item.name);
    expect(hidden(2_000)).toEqual([]);
    expect(hidden(10_000)).toEqual(['tab_hidden']);
    expect(hidden(30_000)).toEqual(['idle']);
  });

  it('never makes a latency signal from a move that expected nothing or a drag', () => {
    const slow = {
      ...base,
      kind: 'ANSWER',
      respondsTo: 'm1',
      text: '7',
      elapsedMs: 60_000,
    } as const;
    const setting = (expects: string) => ({ band: 'early', expects, openQuestion: false }) as const;
    expect(eventSignals(slow, setting('number')).map((item) => item.name)).toEqual([
      'latency_slow',
    ]);
    expect(eventSignals(slow, setting('drag'))).toEqual([]);
    expect(eventSignals(slow, setting('none'))).toEqual([]);
  });

  it('counts a short answer only to an open question', () => {
    const short = { ...base, kind: 'SPEECH_FINAL', text: 'yes' } as const;
    expect(eventSignals(short, { band: 'middle', expects: 'speech', openQuestion: false })).toEqual(
      [],
    );
    expect(
      eventSignals(short, { band: 'middle', expects: 'speech', openQuestion: true }).map(
        (item) => item.name,
      ),
    ).toEqual(['short_answers']);
  });
});
