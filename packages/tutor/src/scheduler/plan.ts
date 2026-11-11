import type { Band } from '@aria/shared';

import type { ProgressMap, SkillGraph } from './graph';
import type { DueSkill, PlanMode, PlanStep, SessionPlan } from './types';

/** Items in a whole session, sized to the band's session length (12 / 20 / 30 minutes). */
export const SESSION_ITEMS: Readonly<Record<Band, number>> = { early: 8, middle: 14, senior: 20 };

/** The most distinct skills one session touches. §5: the early band never more than three. */
export const MAX_SKILLS: Readonly<Record<Band, number>> = { early: 3, middle: 4, senior: 5 };

const WARM_UP_ITEMS = 2;
const ALOUD_ITEMS = 1;
/** A warm-up is something the child already has: easy to get right, a good way in. */
const WARM_UP_STRENGTH = 0.6;

const COUNTING_SUBJECTS: ReadonlySet<string> = new Set([
  'arithmetic',
  'mathematics',
  'math-adventures',
]);

export type PlanInput = Readonly<{
  band: Band;
  due: readonly DueSkill[];
  graph: SkillGraph;
  progress: ProgressMap;
  /** The skill the last session ended on, so the warm-up is not the same thing again. */
  lastSkillCode?: string | null;
}>;

/**
 * One session's plan (P3-04): an easy retrieval to start, then the due skills in rank order,
 * and — for the early band — something read or counted out loud to finish (§5).
 *
 * Empty when nothing is due; the caller then falls back to the class's next topic. The
 * warm-up comes from the same subject as the first due skill, and only from a skill the child
 * already has, so a first session starts with teaching rather than a pretend retrieval.
 */
export function buildSessionPlan(input: PlanInput): SessionPlan {
  const first = input.due[0];
  if (first === undefined) return { steps: [], goalIndirect: false };
  const subject = input.graph.get(first.skillCode)?.subject ?? null;
  const warmUp = warmUpSkill(input, subject);
  const limit = MAX_SKILLS[input.band] - (warmUp === null ? 0 : 1);
  const main = input.due.filter((skill) => skill.skillCode !== warmUp).slice(0, limit);
  const aloud = input.band === 'early';
  const budget =
    SESSION_ITEMS[input.band] - (warmUp === null ? 0 : WARM_UP_ITEMS) - (aloud ? ALOUD_ITEMS : 0);
  const steps: PlanStep[] = [];
  if (warmUp !== null) steps.push({ skillCode: warmUp, mode: 'retrieve', maxItems: WARM_UP_ITEMS });
  main.forEach((skill, index) => {
    steps.push({
      skillCode: skill.skillCode,
      mode: skill.reason === 'new' ? 'teach' : 'practice',
      maxItems: share(budget, main.length, index),
    });
  });
  const last = steps.at(-1);
  if (aloud && last !== undefined) {
    steps.push({ skillCode: last.skillCode, mode: aloudMode(subject), maxItems: ALOUD_ITEMS });
  }
  return { steps, goalIndirect: main.some((skill) => skill.goalIndirect) };
}

function warmUpSkill(input: PlanInput, subject: string | null): string | null {
  const candidates = input.graph.skills
    .filter((skill) => skill.subject === subject)
    .flatMap((skill) => {
      const state = input.progress.get(skill.code);
      return state !== undefined && state.attempts > 0 && state.strength >= WARM_UP_STRENGTH
        ? [{ code: skill.code, strength: state.strength }]
        : [];
    })
    .sort((left, right) => right.strength - left.strength);
  const different = candidates.find((candidate) => candidate.code !== input.lastSkillCode);
  return (different ?? candidates[0])?.code ?? null;
}

/** Items spread as evenly as whole numbers allow, the earlier steps taking any remainder. */
function share(total: number, parts: number, index: number): number {
  const base = Math.floor(total / parts);
  return Math.max(1, base + (index < total % parts ? 1 : 0));
}

function aloudMode(subject: string | null): PlanMode {
  return subject !== null && COUNTING_SUBJECTS.has(subject) ? 'count-aloud' : 'read-aloud';
}
