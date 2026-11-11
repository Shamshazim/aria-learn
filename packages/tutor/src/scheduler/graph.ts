import type { SchedulerSkill, SkillProgress } from './types';

export type ProgressMap = ReadonlyMap<string, SkillProgress>;

/** Prerequisites at or above this unlock a skill the child has already started. */
export const UNLOCK_STRENGTH = 0.6;
/** Prerequisites at or above this unlock a skill the child has never seen. */
export const NEW_SKILL_STRENGTH = 0.7;
/** A prerequisite below this is one a stuck child can be taken back to. */
export const STEP_BACK_BELOW = 0.7;

export class SkillGraphCycleError extends Error {
  override readonly name = 'SkillGraphCycleError';
  constructor(readonly cycle: readonly string[]) {
    super(`Skill prerequisite cycle: ${cycle.join(' -> ')}`);
  }
}

export type SkillGraph = Readonly<{
  /** Every skill, in the order the inventory listed them. */
  skills: readonly SchedulerSkill[];
  get(code: string): SchedulerSkill | null;
  prerequisitesOf(code: string): readonly string[];
  dependentsOf(code: string): readonly string[];
  isUnlocked(code: string, progress: ProgressMap, threshold?: number): boolean;
  /**
   * The weakest skill anywhere underneath this one with strength below `below`, the nearest
   * first on a tie: the step a stuck child goes back to. `null` when everything underneath is
   * solid, or there is nothing underneath.
   */
  weakestPrerequisite(code: string, progress: ProgressMap, below?: number): string | null;
}>;

/**
 * The prerequisite graph, built once and checked once.
 *
 * A cycle is an authoring error that would send a stuck child round in a loop, so it throws
 * here, at startup, with the cycle named — the curriculum validator makes the same check on
 * the authored inventory (`apps/api/src/curriculum/validate.ts`). An edge to a skill that is
 * not in the graph is dropped: the skill it names cannot be scheduled, so it cannot be
 * stepped back to either.
 */
export function createSkillGraph(skills: readonly SchedulerSkill[]): SkillGraph {
  const byCode = new Map(skills.map((skill) => [skill.code, skill]));
  const prerequisites = new Map(
    skills.map((skill) => [skill.code, skill.prerequisites.filter((code) => byCode.has(code))]),
  );
  const dependents = new Map<string, string[]>();
  for (const [code, required] of prerequisites) {
    for (const prerequisite of required) {
      dependents.set(prerequisite, [...(dependents.get(prerequisite) ?? []), code]);
    }
  }
  assertAcyclic(prerequisites);
  const prerequisitesOf = (code: string): readonly string[] => prerequisites.get(code) ?? [];
  return {
    skills,
    get: (code) => byCode.get(code) ?? null,
    prerequisitesOf,
    dependentsOf: (code) => dependents.get(code) ?? [],
    isUnlocked: (code, progress, threshold = UNLOCK_STRENGTH) =>
      prerequisitesOf(code).every((required) => strengthOf(progress, required) >= threshold),
    weakestPrerequisite: (code, progress, below = STEP_BACK_BELOW) =>
      weakest(prerequisitesOf, code, progress, below),
  };
}

export function strengthOf(progress: ProgressMap, code: string): number {
  return progress.get(code)?.strength ?? 0;
}

function weakest(
  prerequisitesOf: (code: string) => readonly string[],
  code: string,
  progress: ProgressMap,
  below: number,
): string | null {
  let best: Readonly<{ code: string; strength: number }> | null = null;
  const seen = new Set<string>([code]);
  // Breadth-first, so the first skill found at a given strength is the nearest one.
  let frontier = prerequisitesOf(code);
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const candidate of frontier) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const strength = strengthOf(progress, candidate);
      if (strength < below && (best === null || strength < best.strength)) {
        best = { code: candidate, strength };
      }
      next.push(...prerequisitesOf(candidate));
    }
    frontier = next;
  }
  return best?.code ?? null;
}

function assertAcyclic(prerequisites: ReadonlyMap<string, readonly string[]>): void {
  const complete = new Set<string>();
  const visit = (code: string, path: string[]): readonly string[] | null => {
    const start = path.indexOf(code);
    if (start >= 0) return [...path.slice(start), code];
    if (complete.has(code)) return null;
    path.push(code);
    for (const required of prerequisites.get(code) ?? []) {
      const cycle = visit(required, path);
      if (cycle !== null) return cycle;
    }
    path.pop();
    complete.add(code);
    return null;
  };
  for (const code of prerequisites.keys()) {
    const cycle = visit(code, []);
    if (cycle !== null) throw new SkillGraphCycleError(cycle);
  }
}
