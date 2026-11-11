import type { ProgressMap, SkillProgress } from '@aria/tutor';

import type { SkillState } from '@/types/skill-state';

/** The stored row, in the shape the scheduler computes with. */
export function toProgress(state: SkillState): SkillProgress {
  return {
    skillCode: state.skillCode,
    strength: state.strength,
    attempts: state.attempts,
    streak: state.correctStreak,
    lapses: state.lapses,
    intervalDays: state.intervalDays,
    lastSeenAt: state.lastSeenAt,
    nextDueAt: state.nextDueAt,
  };
}

export function toSkillState(studentId: string, progress: SkillProgress): SkillState {
  return {
    studentId,
    skillCode: progress.skillCode,
    strength: progress.strength,
    attempts: progress.attempts,
    correctStreak: progress.streak,
    lapses: progress.lapses,
    intervalDays: progress.intervalDays,
    lastSeenAt: progress.lastSeenAt,
    nextDueAt: progress.nextDueAt,
  };
}

export function progressMap(states: readonly SkillState[]): ProgressMap {
  return new Map(states.map((state) => [state.skillCode, toProgress(state)]));
}
