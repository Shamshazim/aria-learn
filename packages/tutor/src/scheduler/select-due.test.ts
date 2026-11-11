import { describe, expect, it } from 'vitest';

import { stepBack, switchStrand } from './backward';
import { createSkillGraph, SkillGraphCycleError } from './graph';
import { buildSessionPlan, MAX_SKILLS } from './plan';
import { dueSkills } from './select-due';
import { freshProgress } from './strength';

import type { ProgressMap } from './graph';
import type { SchedulerSkill, SkillProgress } from './types';

const NOW = new Date('2026-11-10T18:00:00.000Z');
const DAY = 86_400_000;

function skill(code: string, prerequisites: string[] = [], strand = 'addition'): SchedulerSkill {
  return { code, subject: 'arithmetic', strand, band: 'early', prerequisites, facts: false };
}

/** COUNT → ADD5 → ADD10 → ADD20, with SUB5 beside ADD10 and SHAPES in another strand. */
const GRAPH = createSkillGraph([
  skill('COUNT', [], 'number-sense'),
  skill('ADD5', ['COUNT']),
  skill('ADD10', ['ADD5']),
  skill('SUB5', ['COUNT']),
  skill('ADD20', ['ADD10']),
  skill('SHAPES', [], 'geometry'),
  skill('SHAPES2', ['SHAPES'], 'geometry'),
]);

function state(code: string, strength: number, overrides: Partial<SkillProgress> = {}) {
  return [code, { ...freshProgress(code), strength, attempts: 5, ...overrides }] as const;
}

function progress(...entries: (readonly [string, SkillProgress])[]): ProgressMap {
  return new Map(entries);
}

const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY);

describe('skill graph', () => {
  it('names the cycle when the prerequisites loop', () => {
    expect(() =>
      createSkillGraph([skill('A', ['C']), skill('B', ['A']), skill('C', ['B'])]),
    ).toThrow(new SkillGraphCycleError(['A', 'C', 'B', 'A']));
  });

  it('knows dependents and the weakest step underneath, nearest first on a tie', () => {
    expect(GRAPH.dependentsOf('COUNT')).toEqual(['ADD5', 'SUB5']);
    const weak = progress(state('COUNT', 0.4), state('ADD5', 0.5), state('ADD10', 0.2));
    expect(stepBack('ADD20', weak, GRAPH)).toBe('ADD10');
    expect(stepBack('ADD10', weak, GRAPH)).toBe('COUNT');
    const tied = progress(state('COUNT', 0.5), state('ADD5', 0.5));
    expect(stepBack('ADD10', tied, GRAPH)).toBe('ADD5');
    expect(stepBack('ADD10', progress(state('COUNT', 0.9), state('ADD5', 0.8)), GRAPH)).toBeNull();
  });

  it('switches strand when there is nothing to step back to', () => {
    const solid = progress(state('COUNT', 0.9), state('ADD5', 0.9));
    expect(switchStrand('ADD10', solid, GRAPH, NOW)).toBe('COUNT');
    expect(switchStrand('SHAPES2', solid, GRAPH, NOW)).toBe('ADD10');
  });
});

describe('due selection', () => {
  const states = progress(
    state('COUNT', 0.9, { nextDueAt: daysAgo(1), lastSeenAt: daysAgo(8) }),
    state('ADD5', 0.7, { nextDueAt: daysAgo(4) }),
    state('SUB5', 0.45, { nextDueAt: new Date(NOW.getTime() + DAY) }),
    state('SHAPES', 0.9, { nextDueAt: new Date(NOW.getTime() + 9 * DAY) }),
  );

  it('ranks goals, then overdue (most overdue first), then shaky, then one new skill', () => {
    const ranked = dueSkills({
      graph: GRAPH,
      progress: states,
      now: NOW,
      goals: [{ skillCode: 'SHAPES2' }],
    });
    expect(ranked.map((due) => [due.skillCode, due.reason])).toEqual([
      ['SHAPES2', 'goal'],
      ['ADD5', 'overdue'],
      ['COUNT', 'overdue'],
      ['SUB5', 'shaky'],
    ]);
  });

  it('never offers two new skills, counting a new goal as the one', () => {
    const ranked = dueSkills({ graph: GRAPH, progress: states, now: NOW, goals: [] });
    expect(ranked.filter((due) => due.reason === 'new').map((due) => due.skillCode)).toEqual([
      'ADD10',
    ]);
    const withGoal = dueSkills({
      graph: GRAPH,
      progress: states,
      now: NOW,
      goals: [{ skillCode: 'SHAPES2' }],
    });
    expect(withGoal.some((due) => due.reason === 'new')).toBe(false);
  });

  it('honours a locked goal through its weakest prerequisite', () => {
    const ranked = dueSkills({
      graph: GRAPH,
      progress: states,
      now: NOW,
      goals: [{ skillCode: 'ADD20' }],
    });
    expect(ranked[0]).toEqual({ skillCode: 'ADD10', reason: 'goal', goalIndirect: true });
  });

  it('starts a first session on an entry skill', () => {
    const ranked = dueSkills({
      graph: GRAPH,
      progress: new Map(),
      now: NOW,
      goals: [],
      scope: { subject: 'arithmetic' },
    });
    expect(ranked).toEqual([{ skillCode: 'COUNT', reason: 'new', goalIndirect: false }]);
  });

  it('retrieves the longest-unseen strong skill when nothing is due, then one new skill', () => {
    const strong = progress(
      state('COUNT', 0.9, { lastSeenAt: daysAgo(2), nextDueAt: new Date(NOW.getTime() + DAY) }),
      state('ADD5', 0.9, { lastSeenAt: daysAgo(6), nextDueAt: new Date(NOW.getTime() + DAY) }),
    );
    const ranked = dueSkills({
      graph: GRAPH,
      progress: strong,
      now: NOW,
      goals: [],
      scope: { subject: 'arithmetic' },
    });
    expect(ranked.map((due) => [due.skillCode, due.reason])).toEqual([
      ['ADD5', 'retrieval'],
      ['ADD10', 'new'],
    ]);
  });

  it('ignores state for a skill the inventory no longer has', () => {
    const stale = progress(state('RETIRED', 0.1, { nextDueAt: daysAgo(30) }));
    const ranked = dueSkills({ graph: GRAPH, progress: stale, now: NOW, goals: [] });
    expect(ranked.some((due) => due.skillCode === 'RETIRED')).toBe(false);
  });
});

describe('session plan', () => {
  const states = progress(
    state('COUNT', 0.9, { nextDueAt: daysAgo(1) }),
    state('ADD5', 0.7, { nextDueAt: daysAgo(4) }),
    state('SUB5', 0.45),
    state('SHAPES', 0.4),
  );
  const due = dueSkills({ graph: GRAPH, progress: states, now: NOW, goals: [] });

  it('warms up with an easy retrieval and, in the early band, ends out loud with at most three skills', () => {
    const plan = buildSessionPlan({ band: 'early', due, graph: GRAPH, progress: states });
    expect(plan.steps[0]).toMatchObject({ skillCode: 'COUNT', mode: 'retrieve' });
    expect(plan.steps.at(-1)?.mode).toBe('count-aloud');
    expect(new Set(plan.steps.map((step) => step.skillCode)).size).toBeLessThanOrEqual(
      MAX_SKILLS.early,
    );
  });

  it('fills the older bands in rank order up to their skill limit, with no aloud step', () => {
    const plan = buildSessionPlan({ band: 'middle', due, graph: GRAPH, progress: states });
    // Shaky skills come weakest first; the new skill (ADD10) does not fit in four.
    expect(plan.steps.map((step) => [step.skillCode, step.mode])).toEqual([
      ['COUNT', 'retrieve'],
      ['ADD5', 'practice'],
      ['SHAPES', 'practice'],
      ['SUB5', 'practice'],
    ]);
  });

  it('starts a first session with teaching, not a pretend retrieval', () => {
    const first = dueSkills({ graph: GRAPH, progress: new Map(), now: NOW, goals: [] });
    const plan = buildSessionPlan({ band: 'early', due: first, graph: GRAPH, progress: new Map() });
    expect(plan.steps.map((step) => step.mode)).toEqual(['teach', 'count-aloud']);
  });

  it('is empty when nothing is due', () => {
    expect(
      buildSessionPlan({ band: 'early', due: [], graph: GRAPH, progress: states }).steps,
    ).toEqual([]);
  });
});
