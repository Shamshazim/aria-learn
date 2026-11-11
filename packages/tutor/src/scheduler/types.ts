import type { Band, Grade, SkillSubject } from '@aria/shared';

/**
 * The scheduler's view of one skill: where it sits in the graph and nothing about how it is
 * taught. Built from the inventory at startup, so a skill the inventory no longer has is a
 * skill the scheduler cannot see, whatever the database still holds for it.
 */
export type SchedulerSkill = Readonly<{
  code: string;
  subject: SkillSubject;
  strand: string;
  band: Band;
  prerequisites: readonly string[];
  /** Catalogue topics only: the grade and teaching order the curriculum filed it under. */
  grade?: Grade;
  ordering?: number;
  /**
   * A facts skill is one where speed is the skill (`master-plan.md` §6: "7 + 8 must come back
   * in under two seconds without counting"). Only these give half-credit for a slow answer.
   */
  facts: boolean;
}>;

/** One child's standing on one skill, as the scheduler reads and writes it. */
export type SkillProgress = Readonly<{
  skillCode: string;
  /** In [0, 1]. */
  strength: number;
  attempts: number;
  /** Right answers in a row. */
  streak: number;
  /** Wrong answers ever: each one resets the long-interval multiplier. */
  lapses: number;
  intervalDays: number;
  lastSeenAt: Date | null;
  nextDueAt: Date | null;
}>;

/** One graded answer. `correct: null` is an open response, which proves nothing either way. */
export type GradedAttempt = Readonly<{
  correct: boolean | null;
  latencyMs: number | null;
}>;

/** A skill a parent asked for (P6-04 fills these; until then the list is empty). */
export type ActiveGoal = Readonly<{ skillCode: string }>;

export type DueReason = 'goal' | 'overdue' | 'shaky' | 'new' | 'retrieval';

export type DueSkill = Readonly<{
  skillCode: string;
  reason: DueReason;
  /** The goal named a locked skill and this is its weakest prerequisite instead. */
  goalIndirect: boolean;
}>;

export type PlanMode = 'retrieve' | 'teach' | 'practice' | 'read-aloud' | 'count-aloud';

export type PlanStep = Readonly<{ skillCode: string; mode: PlanMode; maxItems: number }>;

/**
 * What one session is going to work on, in order. Written to `session.plan` when the session
 * is created and read back on resume — never rebuilt mid-session, so a reconnect does not
 * change the lesson under the child.
 */
export type SessionPlan = Readonly<{
  steps: readonly PlanStep[];
  goalIndirect: boolean;
}>;
