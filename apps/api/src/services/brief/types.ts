import type { BriefPeriod } from '@aria/shared';

import type { BriefRecord } from '@/types/memory-history';

export type SkillStanding = 'new' | 'practising' | 'strong';

/** What a brief may rest on, gathered for one child and one period (P3-03). */
export type BriefEvidence = Readonly<{
  sessions: number;
  facts: readonly Readonly<{ id: string; text: string }>[];
  episodes: readonly Readonly<{ id: string; text: string }>[];
  /** Skills practised in the period, by name and standing — never a code or a percentage. */
  skills: readonly Readonly<{ code: string; name: string; standing: SkillStanding }>[];
}>;

export type BriefService = Readonly<{
  /** `null` when there is nothing to say: a new child, or a week with no sessions. */
  generate(
    input: Readonly<{ studentId: string; period: BriefPeriod; periodStart: Date }>,
  ): Promise<BriefRecord | null>;
  /** The body of the newest current week brief from the last 14 days, or `null`. */
  currentForTurn(studentId: string, now: Date): Promise<string | null>;
}>;
