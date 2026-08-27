import { describe, expect, it } from 'vitest';

import { BRIDGE_FLOOR_MS, decideBridge, type BridgeContext } from './bridge-rules';

function context(overrides: Partial<BridgeContext> = {}): BridgeContext {
  return {
    intent: 'ANSWER',
    band: 'middle',
    afterMoveKind: 'ASK',
    expectedFirstAudioMs: 1_200,
    childSpeaking: false,
    turnsSinceBridge: null,
    ...overrides,
  };
}

describe('bridge skip rules', () => {
  it('rule 1: says nothing when the real sentence is already about to start', () => {
    expect(decideBridge(context({ expectedFirstAudioMs: BRIDGE_FLOOR_MS - 1 }))).toEqual({
      play: false,
      rule: 'segment-imminent',
    });
    // Exactly at the floor the gap is worth covering; below it, it is not.
    expect(decideBridge(context({ expectedFirstAudioMs: BRIDGE_FLOOR_MS }))).toEqual({
      play: true,
      bucket: 'acknowledge',
    });
  });

  it('rule 1: bridges while the session has no latency estimate yet', () => {
    expect(decideBridge(context({ expectedFirstAudioMs: null })).play).toBe(true);
  });

  it('rule 2: never two bridges in a row', () => {
    expect(decideBridge(context({ turnsSinceBridge: 0 }))).toEqual({
      play: false,
      rule: 'back-to-back',
    });
    expect(decideBridge(context({ turnsSinceBridge: 1 })).play).toBe(true);
  });

  it('rule 3: never over a child who has started speaking again', () => {
    expect(decideBridge(context({ childSpeaking: true }))).toEqual({
      play: false,
      rule: 'child-speaking',
    });
  });

  it('rule 4: never in front of an answer that is fixed and instant', () => {
    expect(decideBridge(context({ intent: 'STOP_REQUEST' }))).toEqual({
      play: false,
      rule: 'fixed-response',
    });
    expect(decideBridge(context({ intent: 'PERSONAL_INFO' }))).toEqual({
      play: false,
      rule: 'fixed-response',
    });
  });

  it('rule 5: buckets by what the child just did', () => {
    expect(decideBridge(context({ intent: 'QUESTION' }))).toEqual({
      play: true,
      bucket: 'thinking',
    });
    expect(decideBridge(context({ intent: 'CONFUSED' }))).toEqual({
      play: true,
      bucket: 'encourage',
    });
    expect(decideBridge(context({ intent: 'CHAT' }))).toEqual({
      play: true,
      bucket: 'acknowledge',
    });
    expect(decideBridge(context({ intent: 'UNCLEAR' }))).toEqual({
      play: true,
      bucket: 'confirm-heard',
    });
    expect(decideBridge(context({ afterMoveKind: 'SWITCH' }))).toEqual({
      play: true,
      bucket: 'transition',
    });
    expect(decideBridge(context({ afterMoveKind: 'BREAK' }))).toEqual({
      play: true,
      bucket: 'transition',
    });
  });

  it('rule 6: the oldest children only ever hear Aria think', () => {
    expect(decideBridge(context({ band: 'senior', intent: 'QUESTION' }))).toEqual({
      play: true,
      bucket: 'thinking',
    });
    expect(decideBridge(context({ band: 'senior', intent: 'ANSWER' }))).toEqual({
      play: false,
      rule: 'band-cadence',
    });
  });

  it('rule 6: the youngest hear one at most every other turn', () => {
    expect(decideBridge(context({ band: 'early', turnsSinceBridge: 0 }))).toEqual({
      play: false,
      rule: 'back-to-back',
    });
    expect(decideBridge(context({ band: 'early', turnsSinceBridge: 1 })).play).toBe(true);
  });
});
