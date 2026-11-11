import type { Logger } from '@/lib/logger';

/**
 * After a correction the week's learner brief may say something that is no longer true, so it
 * is rebuilt before the next arrival reads it (P3-06). Rebuilding is P3-03's: until that
 * generator exists the port records that a rebuild is owed, so the moment it lands the
 * schedule is already being kept.
 */
export type BriefInvalidation = (
  input: Readonly<{ studentId: string; correctionId: string; at: Date }>,
) => Promise<void>;

export function createBriefInvalidation(logger: Pick<Logger, 'info'>): BriefInvalidation {
  return (input) => {
    logger.info(
      {
        event: 'memory.brief.invalidated',
        studentId: input.studentId,
        correctionId: input.correctionId,
      },
      'A correction made the current learner brief stale; it is due to be rebuilt',
    );
    return Promise.resolve();
  };
}
