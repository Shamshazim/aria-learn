import { describe, expect, it } from 'vitest';

import { intervalDays, nextDueAt, resolveTimeZone, schedule } from './interval';
import { AUTOMATIC_MS, freshProgress, updateStrength } from './strength';

import type { SkillProgress } from './types';

const NOW = new Date('2026-11-10T18:00:00.000Z');
const DAY = 86_400_000;

function progress(overrides: Partial<SkillProgress> = {}): SkillProgress {
  return { ...freshProgress('ADD.FACT.10'), ...overrides };
}

describe('strength update', () => {
  it.each([
    { name: 'right from nothing', before: 0, correct: true, strength: 0.3, streak: 1, lapses: 0 },
    { name: 'right from 0.5', before: 0.5, correct: true, strength: 0.65, streak: 1, lapses: 0 },
    { name: 'right at the top', before: 1, correct: true, strength: 1, streak: 1, lapses: 0 },
    { name: 'wrong from 0.5', before: 0.5, correct: false, strength: 0.3, streak: 0, lapses: 1 },
    { name: 'wrong from nothing', before: 0, correct: false, strength: 0, streak: 0, lapses: 1 },
  ])('$name', ({ before, correct, strength, streak, lapses }) => {
    const after = updateStrength(
      progress({ strength: before }),
      { correct, latencyMs: 900 },
      false,
      NOW,
    );
    expect(after).toMatchObject({ strength, streak, lapses, attempts: 1, lastSeenAt: NOW });
  });

  it('gives half-credit for a slow right answer on a facts skill, and keeps the streak', () => {
    const before = progress({ strength: 0.5, streak: 2 });
    const slow = updateStrength(before, { correct: true, latencyMs: AUTOMATIC_MS + 1 }, true, NOW);
    expect(slow).toMatchObject({ strength: 0.575, streak: 2 });
    const quick = updateStrength(before, { correct: true, latencyMs: AUTOMATIC_MS }, true, NOW);
    expect(quick).toMatchObject({ strength: 0.65, streak: 3 });
  });

  it('only penalises slowness on facts skills', () => {
    const after = updateStrength(
      progress({ strength: 0.5 }),
      { correct: true, latencyMs: 60_000 },
      false,
      NOW,
    );
    expect(after.strength).toBe(0.65);
  });

  it('wrong resets the streak and counts a lapse', () => {
    const after = updateStrength(
      progress({ strength: 0.9, streak: 7, lapses: 1 }),
      { correct: false, latencyMs: null },
      false,
      NOW,
    );
    expect(after).toMatchObject({ streak: 0, lapses: 2, strength: 0.54 });
  });

  it('changes nothing for an open response', () => {
    const before = progress({ strength: 0.4, streak: 1 });
    expect(updateStrength(before, { correct: null, latencyMs: 500 }, true, NOW)).toBe(before);
  });
});

describe('interval table', () => {
  it.each([
    [0, 0, 1],
    [0.29, 9, 1],
    [0.3, 0, 3],
    [0.59, 9, 3],
    [0.6, 0, 7],
    [0.79, 9, 7],
    [0.8, 0, 21],
    [0.8, 4, 21],
    [0.8, 5, 31.5],
    [0.9, 6, 47.25],
    [0.95, 7, 60],
    [1, 20, 60],
  ] as const)('strength %s with streak %s is %s days', (strength, streak, days) => {
    expect(intervalDays(strength, streak)).toBe(days);
  });

  it('a lapse resets the multiplier', () => {
    const stretched = progress({ strength: 0.95, streak: 7 });
    expect(intervalDays(stretched.strength, stretched.streak)).toBe(60);
    const lapsed = updateStrength(stretched, { correct: false, latencyMs: null }, false, NOW);
    const recovered = updateStrength(
      { ...lapsed, strength: 0.95 },
      { correct: true, latencyMs: null },
      false,
      NOW,
    );
    expect(recovered.streak).toBe(1);
    expect(intervalDays(recovered.strength, recovered.streak)).toBe(21);
  });
});

describe('due dates in the child’s own day', () => {
  it('a session at 23:30 and one at 00:10 are on different days', () => {
    const tz = 'America/Los_Angeles';
    const lateEvening = new Date('2026-11-11T07:30:00.000Z'); // 23:30 on the 10th in LA
    const pastMidnight = new Date('2026-11-11T08:10:00.000Z'); // 00:10 on the 11th
    expect(nextDueAt(1, lateEvening, tz).toISOString()).toBe('2026-11-11T08:00:00.000Z');
    expect(nextDueAt(1, pastMidnight, tz).toISOString()).toBe('2026-11-12T08:00:00.000Z');
  });

  it('lands on local midnight across a clock change', () => {
    // US clocks went back on 2026-11-01; three days from 31 October is after the change.
    const due = nextDueAt(3, new Date('2026-10-31T19:00:00.000Z'), 'America/New_York');
    expect(due.toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });

  it('rounds a fractional interval up to a whole day', () => {
    expect(nextDueAt(31.5, NOW, 'UTC').toISOString()).toBe('2026-12-12T00:00:00.000Z');
  });

  it('falls back to UTC for a missing or unknown timezone', () => {
    expect(resolveTimeZone(null)).toBe('UTC');
    expect(resolveTimeZone('Mars/Olympus_Mons')).toBe('UTC');
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London');
  });

  it('never shortens an interval for days missed (property)', () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let run = 0; run < 1_000; run += 1) {
      const state = progress({
        strength: Math.round(random() * 1000) / 1000,
        streak: Math.floor(random() * 12),
        lapses: Math.floor(random() * 4),
        attempts: 1 + Math.floor(random() * 30),
      });
      const correct = random() < 0.5 ? null : random() < 0.6;
      const graded = { correct, latencyMs: Math.floor(random() * 5_000) };
      const facts = random() < 0.5;
      const onTime = schedule(updateStrength(state, graded, facts, NOW), NOW, 'UTC');
      const late = new Date(NOW.getTime() + 7 * DAY);
      const missedWeek = schedule(updateStrength(state, graded, facts, late), late, 'UTC');
      expect(missedWeek.intervalDays).toBe(onTime.intervalDays);
      expect(missedWeek.strength).toBe(onTime.strength);
      expect((missedWeek.nextDueAt?.getTime() ?? 0) - late.getTime()).toBeGreaterThanOrEqual(
        (onTime.nextDueAt?.getTime() ?? 0) - NOW.getTime(),
      );
    }
  });
});
