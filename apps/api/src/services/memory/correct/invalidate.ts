import type { Logger } from '@/lib/logger';

/**
 * After a correction the week's learner brief may say something that is no longer true, so it
 * is rebuilt before the next arrival reads it (P3-06, P3-03). The rebuild is a model call and
 * runs in the background: a parent's request, or a child's turn, does not wait for it.
 */
export type BriefInvalidation = (
  input: Readonly<{ studentId: string; correctionId: string; at: Date }>,
) => Promise<void>;

export function createBriefInvalidation(deps: {
  logger: Pick<Logger, 'info' | 'warn'>;
  /** Writes a new version of the week brief that contains `at`. */
  regenerate(studentId: string, at: Date): Promise<unknown>;
  schedule(task: () => Promise<void>): void;
}): BriefInvalidation {
  return (input) => {
    deps.logger.info(
      {
        event: 'memory.brief.invalidated',
        studentId: input.studentId,
        correctionId: input.correctionId,
      },
      'A correction made the current learner brief stale; rebuilding it',
    );
    deps.schedule(async () => {
      try {
        await deps.regenerate(input.studentId, input.at);
      } catch (error) {
        deps.logger.warn(
          { event: 'brief.rebuild.failed', err: error, studentId: input.studentId },
          'The brief rebuild after a correction failed; the next scheduled run will retry',
        );
      }
    });
    return Promise.resolve();
  };
}
