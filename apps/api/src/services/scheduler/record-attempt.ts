import {
  CLEARING_CORRECT,
  freshProgress,
  resolveTimeZone,
  schedule,
  updateStrength,
  type SkillGraph,
} from '@aria/tutor';

import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { SkillState } from '@/types/skill-state';

import { toProgress, toSkillState } from './scheduler-state';

export type AttemptInput = Readonly<{
  studentId: string;
  skillCode: string;
  correct: boolean;
  /** How long the answer took, where the client measured it; only facts skills care. */
  latencyMs: number | null;
  at: Date;
}>;

/**
 * One graded answer, through the scheduler and into `skill_state` (P3-04).
 *
 * Called inside the turn's transaction with a repository bound to it: the row is locked,
 * updated by the pure strength and interval rules, and written back whole. A right answer
 * also counts towards clearing the skill's live misconceptions.
 */
export async function recordAttempt(
  skills: SkillStateRepository,
  graph: SkillGraph,
  input: AttemptInput,
): Promise<SkillState> {
  const [stored, timeZone] = await Promise.all([
    skills.findForUpdate(input.studentId, input.skillCode),
    skills.timeZoneOf(input.studentId),
  ]);
  const before = stored === null ? freshProgress(input.skillCode) : toProgress(stored);
  const facts = graph.get(input.skillCode)?.facts ?? false;
  const graded = { correct: input.correct, latencyMs: input.latencyMs };
  const after = schedule(
    updateStrength(before, graded, facts, input.at),
    input.at,
    resolveTimeZone(timeZone),
  );
  const state = toSkillState(input.studentId, after);
  await skills.bulkUpsert([state]);
  if (input.correct) {
    await skills.creditMisconceptions({
      studentId: input.studentId,
      skillCode: input.skillCode,
      clearAfter: CLEARING_CORRECT,
    });
  }
  return state;
}
