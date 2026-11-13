import { describe, expect, it } from 'vitest';

import type { GradedAttempt, SessionSpan } from '@/repositories/consolidation-history.repository';
import type { SessionEventRecord } from '@/types/session';

import { detectEpisodes, type EpisodeInput } from './episodes';

const DAY = 86_400_000;
const T0 = new Date('2026-10-01T16:00:00.000Z');
const at = (days: number, minutes = 0): Date =>
  new Date(T0.getTime() + days * DAY + minutes * 60_000);

function span(id: string, days: number): SessionSpan {
  return { id, startedAt: at(days), endedAt: at(days, 20) };
}

let n = 0;
function attempt(sessionId: string, days: number, correct: boolean): GradedAttempt {
  n += 1;
  return {
    eventId: `a-${String(n)}`,
    sessionId,
    skillCode: 'ADD.REGROUP.2D',
    correct,
    latencyMs: 4_000,
    at: at(days, n % 15),
  };
}

function move(
  kind: string,
  skillCode: string,
  extra: Record<string, unknown> = {},
): SessionEventRecord {
  n += 1;
  return {
    id: `m-${String(n)}`,
    sessionId: 's3',
    seq: n,
    at: at(20, n % 15),
    actor: 'aria',
    kind,
    text: 'Let us try another way.',
    skillCode,
    correct: null,
    latencyMs: null,
    evidence: extra,
    payload: {},
  };
}

function child(skillCode: string): SessionEventRecord {
  return { ...move('ANSWER', skillCode), actor: 'child', kind: 'ANSWER', text: '5' };
}

function input(overrides: Partial<EpisodeInput>): EpisodeInput {
  return {
    session: span('s3', 20),
    events: [child('ADD.REGROUP.2D')],
    previousSession: span('s2', 10),
    attempts: [],
    goals: [],
    skillName: (code) =>
      code === 'ADD.REGROUP.2D' ? 'Adding two-digit numbers with regrouping' : null,
    isFacts: () => false,
    ...overrides,
  };
}

/** Two sessions that stayed weak, then the session where it clicked. */
const BREAKTHROUGH_HISTORY: GradedAttempt[] = [
  attempt('s1', 0, false),
  attempt('s1', 0, true),
  attempt('s2', 10, false),
  attempt('s2', 10, true),
  ...Array.from({ length: 6 }, () => attempt('s3', 20, true)),
];

const kinds = (episodes: ReturnType<typeof detectEpisodes>) =>
  episodes.map((episode) => episode.kind);

describe('episode detectors (P3-02)', () => {
  it('breakthrough: crosses 0.7 after two sessions below 0.5', () => {
    const episodes = detectEpisodes(input({ attempts: BREAKTHROUGH_HISTORY }));
    expect(kinds(episodes)).toContain('breakthrough');
    const breakthrough = episodes.find((episode) => episode.kind === 'breakthrough');
    expect(breakthrough).toMatchObject({ importance: 0.9, skillCode: 'ADD.REGROUP.2D' });
    expect(breakthrough?.evidence.length).toBe(6);
  });

  it('near-miss: the same climb with only one weak session before it is not a breakthrough', () => {
    const oneWeak = BREAKTHROUGH_HISTORY.filter((item) => item.sessionId !== 's1');
    expect(kinds(detectEpisodes(input({ attempts: oneWeak })))).not.toContain('breakthrough');
  });

  it('goal reached: a goal skill crosses 0.8, and not when no goal names it', () => {
    const climb = [
      ...BREAKTHROUGH_HISTORY,
      ...Array.from({ length: 3 }, () => attempt('s3', 20, true)),
    ];
    expect(
      kinds(detectEpisodes(input({ attempts: climb, goals: [{ skillCode: 'ADD.REGROUP.2D' }] }))),
    ).toContain('goal_reached');
    expect(kinds(detectEpisodes(input({ attempts: climb })))).not.toContain('goal_reached');
  });

  it('struggle: three reteaches on one skill, or a step back — not two reteaches', () => {
    const three = [
      child('ADD.REGROUP.2D'),
      ...['RETEACH', 'RETEACH', 'RETEACH'].map((kind) => move(kind, 'ADD.REGROUP.2D')),
    ];
    expect(kinds(detectEpisodes(input({ events: three })))).toEqual(['struggle']);
    const two = three.slice(0, 3);
    expect(kinds(detectEpisodes(input({ events: two })))).toEqual([]);
    const stepBack = [
      child('ADD.REGROUP.2D'),
      move('SWITCH', 'ADD.FACT.10', { approach: 'prerequisite-step' }),
    ];
    expect(detectEpisodes(input({ events: stepBack }))[0]).toMatchObject({
      kind: 'struggle',
      skillCode: 'ADD.REGROUP.2D',
    });
    const mastered = [
      child('ADD.REGROUP.2D'),
      move('SWITCH', 'ADD.FACT.20', { approach: 'next-topic' }),
    ];
    expect(kinds(detectEpisodes(input({ events: mastered })))).toEqual([]);
  });

  it('return after absence: fourteen days away, and not thirteen', () => {
    expect(kinds(detectEpisodes(input({ previousSession: span('s2', 5) })))).toEqual([
      'return_after_absence',
    ]);
    const thirteen = { ...span('s2', 6), endedAt: at(7, 1) };
    expect(kinds(detectEpisodes(input({ previousSession: thirteen })))).toEqual([]);
  });

  it('skips a skill the inventory no longer has', () => {
    const episodes = detectEpisodes(
      input({ attempts: BREAKTHROUGH_HISTORY, skillName: () => null }),
    );
    expect(kinds(episodes)).not.toContain('breakthrough');
  });

  it('gives every episode at least one piece of evidence', () => {
    const all = [
      ...detectEpisodes(input({ attempts: BREAKTHROUGH_HISTORY, previousSession: span('s2', 1) })),
      ...detectEpisodes(
        input({
          events: [
            child('ADD.REGROUP.2D'),
            ...['RETEACH', 'RETEACH', 'RETEACH'].map((kind) => move(kind, 'ADD.REGROUP.2D')),
          ],
        }),
      ),
    ];
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const episode of all) expect(episode.evidence.length).toBeGreaterThan(0);
  });
});
