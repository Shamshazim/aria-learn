import { describe, expect, it } from 'vitest';

import { sentencesOf } from '@/quality/checks/level/readability';
import { buildRecap } from '@/services/session/recap';
import { sessionSummary } from '@/services/session/recap-text';
import type { SessionEventRecord } from '@/types/session';

const NAMES: Readonly<Record<string, string>> = {
  'ADD.REGROUP.2D': 'Add two-digit numbers with regrouping',
  'ADD.FACT.10': 'Recall addition facts within 10',
};
const skillName = (code: string): string | null => NAMES[code] ?? null;

describe('the session recap', () => {
  it('counts what was attempted and what came out right', () => {
    const recap = buildRecap(session(), skillName);
    expect(recap.attempted).toBe(4);
    expect(recap.correct).toBe(2);
    expect(recap.skills.map((skill) => skill.name)).toEqual([
      'Add two-digit numbers with regrouping',
    ]);
  });

  /** The moment a session is remembered for: the one they would not have got on arrival. */
  it('prefers a correct answer that followed a reteach', () => {
    expect(buildRecap(session(), skillName).moment).toMatchObject({
      kind: 'after-reteach',
      skillCode: 'ADD.REGROUP.2D',
    });
  });

  it('falls back to persistence, then to the first correct answer', () => {
    const persisted = buildRecap([child(1, false), child(2, false), child(3, true)], skillName);
    expect(persisted.moment).toMatchObject({ kind: 'persistence' });
    expect(buildRecap([child(1, true)], skillName).moment).toMatchObject({
      kind: 'first-correct',
    });
    expect(buildRecap([], skillName).moment).toBeNull();
  });

  it('counts the run of correct answers the session ended on', () => {
    expect(
      buildRecap([child(1, false), child(2, true), child(3, true)], skillName).finalStreak,
    ).toBe(2);
  });
});

describe('the summary written down', () => {
  it('keeps the ending the child actually heard', () => {
    const spoken = 'You stayed with regrouping today. See you next time.';
    expect(
      sessionSummary({ endText: spoken, recap: buildRecap(session(), skillName), subject: 'math' }),
    ).toBe(spoken);
  });

  /** §14: never a score, and never nothing — a session that happened gets written down. */
  it.each([
    ['no ending was ever said', null],
    ['the ending recited a score', 'You got 3 out of 4 today. See you next time.'],
    ['the ending ran long', 'One. Two. Three. Four.'],
  ] as const)('writes its own summary when %s', (_name, endText) => {
    const summary = sessionSummary({
      endText,
      recap: buildRecap(session(), skillName),
      subject: 'math',
    });
    expect(summary).not.toBe(endText);
    expect(summary).not.toMatch(/\d/u);
    expect(sentencesOf(summary).length).toBeLessThanOrEqual(3);
    expect(summary.length).toBeGreaterThan(0);
  });

  it('does not claim work in a session where nothing was answered', () => {
    const summary = sessionSummary({
      endText: null,
      recap: buildRecap([], skillName),
      subject: 'reading',
    });
    expect(summary).toContain('made a start');
  });
});

/** Four attempts on one skill, with the third taught again before it came out right. */
function session(): readonly SessionEventRecord[] {
  return [child(1, false), aria(2, 'RETEACH'), child(3, true), child(4, false), child(5, true)];
}

function child(seq: number, correct: boolean): SessionEventRecord {
  return {
    ...base(seq),
    actor: 'child',
    kind: 'ANSWER',
    correct,
    skillCode: 'ADD.REGROUP.2D',
  };
}

function aria(seq: number, kind: string): SessionEventRecord {
  return { ...base(seq), actor: 'aria', kind };
}

function base(seq: number): SessionEventRecord {
  return {
    id: `event-${String(seq)}`,
    sessionId: 'session-1',
    seq,
    at: new Date('2026-08-25T10:00:00.000Z'),
    actor: 'child',
    kind: 'ANSWER',
    text: null,
    skillCode: null,
    correct: null,
    latencyMs: null,
    evidence: {},
    payload: {},
  };
}
