import { describe, expect, it } from 'vitest';

import {
  IDLE_WARNING_MS,
  KEEP_ALIVE_GAP_MS,
  idleStatus,
  shouldKeepAlive,
} from '@/features/auth/model/idle-timer';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const at = (ms: number): Date => new Date(NOW.getTime() + ms);

describe('the idle clock', () => {
  it.each([
    ['well before the deadline', 30 * 60_000, 'active'],
    ['just before the warning', IDLE_WARNING_MS + 1_000, 'active'],
    ['at the warning', IDLE_WARNING_MS, 'warning'],
    ['inside the warning', 30_000, 'warning'],
    ['at the deadline', 0, 'expired'],
    ['past the deadline', -60_000, 'expired'],
  ])('%s', (_name, remaining, expected) => {
    expect(idleStatus(at(remaining), NOW)).toBe(expected);
  });
});

describe('telling the server the device is in use', () => {
  it('says so the first time without waiting', () => {
    expect(shouldKeepAlive(null, NOW)).toBe(true);
  });

  it('does not say so again until the gap has passed', () => {
    expect(shouldKeepAlive(NOW, at(KEEP_ALIVE_GAP_MS - 1))).toBe(false);
    expect(shouldKeepAlive(NOW, at(KEEP_ALIVE_GAP_MS))).toBe(true);
  });
});
