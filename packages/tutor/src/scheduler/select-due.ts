import type { Band, Grade } from '@aria/shared';

import { NEW_SKILL_STRENGTH, strengthOf, type ProgressMap, type SkillGraph } from './graph';

import type { ActiveGoal, DueSkill, SchedulerSkill } from './types';

export type DueScope = Readonly<{ subject?: string; band?: Band; grade?: Grade }>;

export type DueInput = Readonly<{
  graph: SkillGraph;
  progress: ProgressMap;
  now: Date;
  goals: readonly ActiveGoal[];
  /** The class being chosen for: only its skills are ranked, and its band and grade go first. */
  scope?: DueScope;
}>;

const SHAKY_FROM = 0.3;
const SHAKY_BELOW = 0.6;

/**
 * What is due for this child, best first (P3-04):
 *
 * 1. skills a parent goal names — or, for a goal still locked, its weakest prerequisite;
 * 2. overdue skills, the most overdue first;
 * 3. shaky skills (0.3–0.6) whose prerequisites are all at 0.6 or more, the weakest first;
 * 4. when nothing above is due, the strong skill seen longest ago, for a short retrieval;
 * 5. one new skill whose prerequisites are all at 0.7 or more.
 *
 * Never more than one new skill, counting a goal that is new: a session that introduces two
 * ideas teaches neither. A skill the child has state for but the inventory no longer lists is
 * not in the graph and so never appears.
 */
export function dueSkills(input: DueInput): readonly DueSkill[] {
  const ranked: DueSkill[] = [];
  const add = (skill: DueSkill): void => {
    if (!ranked.some((existing) => existing.skillCode === skill.skillCode)) ranked.push(skill);
  };
  const inScope = scoped(input);
  for (const goal of goalSkills(input, inScope)) add(goal);
  for (const code of overdue(input, inScope)) add(due(code, 'overdue'));
  for (const code of shaky(input, inScope)) add(due(code, 'shaky'));
  if (ranked.length === 0) {
    const retrieval = leastRecentlySeen(input, inScope);
    if (retrieval !== null) add(due(retrieval, 'retrieval'));
  }
  if (!ranked.some((skill) => isNew(input.progress, skill.skillCode))) {
    const fresh = newSkill(input, inScope);
    if (fresh !== null) add(due(fresh, 'new'));
  }
  return ranked;
}

function due(skillCode: string, reason: DueSkill['reason'], goalIndirect = false): DueSkill {
  return { skillCode, reason, goalIndirect };
}

function scoped(input: DueInput): readonly SchedulerSkill[] {
  const subject = input.scope?.subject;
  return subject === undefined
    ? input.graph.skills
    : input.graph.skills.filter((skill) => skill.subject === subject);
}

function goalSkills(input: DueInput, inScope: readonly SchedulerSkill[]): readonly DueSkill[] {
  const codes = new Set(inScope.map((skill) => skill.code));
  return input.goals.flatMap((goal) => {
    if (!codes.has(goal.skillCode)) return [];
    if (input.graph.isUnlocked(goal.skillCode, input.progress)) {
      return [due(goal.skillCode, 'goal')];
    }
    // A locked goal is honoured by building towards it.
    const step = input.graph.weakestPrerequisite(goal.skillCode, input.progress);
    return step === null ? [] : [due(step, 'goal', true)];
  });
}

function overdue(input: DueInput, inScope: readonly SchedulerSkill[]): readonly string[] {
  return inScope
    .flatMap((skill) => {
      const dueAt = input.progress.get(skill.code)?.nextDueAt ?? null;
      return dueAt !== null && dueAt.getTime() <= input.now.getTime()
        ? [{ code: skill.code, at: dueAt.getTime() }]
        : [];
    })
    .sort((left, right) => left.at - right.at || compare(left.code, right.code))
    .map((entry) => entry.code);
}

function shaky(input: DueInput, inScope: readonly SchedulerSkill[]): readonly string[] {
  return inScope
    .filter((skill) => {
      const state = input.progress.get(skill.code);
      return (
        state !== undefined &&
        state.attempts > 0 &&
        state.strength >= SHAKY_FROM &&
        state.strength < SHAKY_BELOW &&
        input.graph.isUnlocked(skill.code, input.progress)
      );
    })
    .sort(
      (left, right) =>
        strengthOf(input.progress, left.code) - strengthOf(input.progress, right.code) ||
        compare(left.code, right.code),
    )
    .map((skill) => skill.code);
}

function leastRecentlySeen(input: DueInput, inScope: readonly SchedulerSkill[]): string | null {
  const seen = inScope.flatMap((skill) => {
    const at = input.progress.get(skill.code)?.lastSeenAt ?? null;
    return at === null ? [] : [{ code: skill.code, at: at.getTime() }];
  });
  seen.sort((left, right) => left.at - right.at || compare(left.code, right.code));
  return seen[0]?.code ?? null;
}

/** The first unseen, unlocked skill: the class's grade, then its band, then teaching order. */
function newSkill(input: DueInput, inScope: readonly SchedulerSkill[]): string | null {
  const candidates = inScope.filter(
    (skill) =>
      isNew(input.progress, skill.code) &&
      input.graph.isUnlocked(skill.code, input.progress, NEW_SKILL_STRENGTH),
  );
  const fit = (skill: SchedulerSkill): number =>
    (input.scope?.grade !== undefined && skill.grade === input.scope.grade ? 0 : 2) +
    (input.scope?.band !== undefined && skill.band === input.scope.band ? 0 : 1);
  // A stable sort keeps inventory order between equals, which is the authored order.
  const ordered = [...candidates].sort(
    (left, right) => fit(left) - fit(right) || (left.ordering ?? 0) - (right.ordering ?? 0),
  );
  return ordered[0]?.code ?? null;
}

function isNew(progress: ProgressMap, code: string): boolean {
  return (progress.get(code)?.attempts ?? 0) === 0;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
