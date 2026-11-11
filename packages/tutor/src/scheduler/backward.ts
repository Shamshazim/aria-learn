import { NEW_SKILL_STRENGTH } from './graph';
import { dueSkills } from './select-due';

import type { ProgressMap, SkillGraph } from './graph';

/**
 * Where a stuck child goes back to (P3-04): the weakest prerequisite under the skill with
 * strength below 0.7. `null` when everything underneath is solid — the policy then changes
 * strand instead (`switchStrand`), because more of the same is not an option.
 */
export function stepBack(
  skillCode: string,
  progress: ProgressMap,
  graph: SkillGraph,
): string | null {
  return graph.weakestPrerequisite(skillCode, progress);
}

/**
 * The best-ranked due skill in the same subject but a different strand: a change of scene for
 * a child who is stuck on something with nothing weak underneath it. `null` when the subject
 * has only the one strand, or nothing in another is open yet.
 */
export function switchStrand(
  skillCode: string,
  progress: ProgressMap,
  graph: SkillGraph,
  now: Date,
): string | null {
  const current = graph.get(skillCode);
  if (current === null) return null;
  const elsewhere = (code: string): boolean => graph.get(code)?.strand !== current.strand;
  const ranked = dueSkills({
    graph,
    progress,
    now,
    goals: [],
    scope: { subject: current.subject },
  });
  const due = ranked.find((skill) => elsewhere(skill.skillCode));
  if (due !== undefined) return due.skillCode;
  // Nothing in another strand is due: its first open skill, in teaching order, will do.
  const open = graph.skills.find(
    (skill) =>
      skill.subject === current.subject &&
      elsewhere(skill.code) &&
      graph.isUnlocked(skill.code, progress, NEW_SKILL_STRENGTH),
  );
  return open?.code ?? null;
}
