import type { Skill } from '@aria/shared';

export type SkillState = Readonly<{
  studentId: string;
  skillCode: string;
  strength: number;
  attempts: number;
  correctStreak: number;
  /** P3-04: wrong answers ever; each one restarts the long-interval multiplier. */
  lapses: number;
  /** P3-04: the gap the scheduler chose last, in days. */
  intervalDays: number;
  lastSeenAt: Date | null;
  nextDueAt: Date | null;
}>;

export type RuntimeSkill = Pick<
  Skill,
  'code' | 'subject' | 'strand' | 'name' | 'band' | 'prerequisites'
>;

export type MisconceptionState = Readonly<{
  misconceptionId: string;
  seenCount: number;
  firstSeenAt: Date;
  secondOrLater: boolean;
  /** P3-04: three right answers on the skill since it was last seen. */
  cleared: boolean;
}>;
