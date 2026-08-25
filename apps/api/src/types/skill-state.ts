import type { Skill } from '@aria/shared';

export type SkillState = Readonly<{
  studentId: string;
  skillCode: string;
  strength: number;
  attempts: number;
  correctStreak: number;
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
}>;
