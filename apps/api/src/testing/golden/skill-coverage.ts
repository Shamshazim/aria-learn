import type { GoldenItem } from '@/testing/golden/types';

/** P3-07: a skill with fewer golden cases than this cannot ship (`master-plan.md` §13). */
export const MIN_CASES_PER_SKILL = 5;

export type SkillShortfall = Readonly<{ skillCode: string; cases: number }>;

/** Every listed skill with too few golden cases, and how many it has. Empty means all ship. */
export function skillsBelowMinimum(
  items: readonly GoldenItem[],
  skillCodes: readonly string[],
  minimum = MIN_CASES_PER_SKILL,
): readonly SkillShortfall[] {
  return skillCodes.flatMap((skillCode) => {
    const cases = items.filter((item) => item.skillCode === skillCode).length;
    return cases < minimum ? [{ skillCode, cases }] : [];
  });
}
