/**
 * The client's half of the idle rule (P2H-12).
 *
 * Advisory, and deliberately so: the server ends a session on its own clock, and a device that
 * disagrees about the time must not be able to extend one by saying so. What this is for is
 * the warning — a child who has wandered off deserves "are you still there?" before the screen
 * empties — and for deciding when a device that *is* being used should say so.
 *
 * Pure. No timers and no `Date.now()`: given the deadline and the moment, it says what the
 * screen should show, and the hook that owns the interval decides how often to ask.
 */
export type IdleStatus = 'active' | 'warning' | 'expired';

/** How long before the deadline the "still there?" prompt appears. */
export const IDLE_WARNING_MS = 2 * 60 * 1_000;

/**
 * A device being used tells the server so at most this often. Every refresh is a write and a
 * rotated cookie, so it is worth doing rarely and worth doing well before the deadline.
 */
export const KEEP_ALIVE_GAP_MS = 5 * 60 * 1_000;

export function idleStatus(deadline: Date, now: Date): IdleStatus {
  const remaining = deadline.getTime() - now.getTime();
  if (remaining <= 0) return 'expired';
  return remaining <= IDLE_WARNING_MS ? 'warning' : 'active';
}

/** Has enough happened, and enough time passed, to be worth telling the server about? */
export function shouldKeepAlive(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= KEEP_ALIVE_GAP_MS;
}
