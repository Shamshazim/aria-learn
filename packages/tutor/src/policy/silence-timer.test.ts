import { describe, expect, it } from 'vitest';

import type { MoveKind } from '@aria/shared';

import { shouldArmSilenceTimer, silenceWindowMs } from './silence-timer';

const ARMED = {
  move: { kind: 'ASK' as MoveKind, expects: 'text' as const },
  speaking: false,
  attended: true,
};

describe('shouldArmSilenceTimer', () => {
  it('arms after a question the child is expected to answer', () => {
    expect(shouldArmSilenceTimer(ARMED)).toBe(true);
  });

  it('never arms on LISTEN, whatever the move expects', () => {
    for (const expects of ['speech', 'text', 'choice', 'none'] as const) {
      expect(shouldArmSilenceTimer({ ...ARMED, move: { kind: 'LISTEN', expects } })).toBe(false);
    }
  });

  it('never arms while Aria is speaking', () => {
    expect(shouldArmSilenceTimer({ ...ARMED, speaking: true })).toBe(false);
  });

  it('never arms when nobody is attending the session', () => {
    expect(shouldArmSilenceTimer({ ...ARMED, attended: false })).toBe(false);
  });

  it('never arms with no move, or on a move that expects nothing', () => {
    expect(shouldArmSilenceTimer({ ...ARMED, move: null })).toBe(false);
    expect(shouldArmSilenceTimer({ ...ARMED, move: { kind: 'SAY', expects: 'none' } })).toBe(false);
  });
});

describe('silenceWindowMs', () => {
  it('gives younger children less dead air', () => {
    expect(silenceWindowMs('early')).toBeLessThan(silenceWindowMs('middle'));
    expect(silenceWindowMs('middle')).toBeLessThan(silenceWindowMs('senior'));
  });
});
