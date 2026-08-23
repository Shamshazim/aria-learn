/**
 * Time as a dependency.
 *
 * A service never calls `Date.now()` inline (CODE-STANDARDS §4): a test that has to wait for
 * real time is a test that eventually flakes. Every service that needs the time takes a
 * `Clock` and the composition root decides which one it gets.
 */
export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock a test controls. Not exported to production code — it is a fake, not a stub. */
export function fixedClock(at: Date): Clock {
  return { now: () => at };
}
