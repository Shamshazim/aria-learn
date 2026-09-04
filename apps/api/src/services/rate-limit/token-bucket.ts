import type { RateLimitDecision, RateLimitPolicy } from '@/types/rate-limit';

/**
 * The token bucket arithmetic, as pure functions (X-05).
 *
 * Separated from every store so the two adapters cannot disagree about what a limit *means*.
 * The in-memory store calls this; the Postgres store reimplements it in SQL because the
 * refill has to happen inside the same statement that spends the token, and
 * `token-bucket.test.ts` is what holds the two to the same answers.
 *
 * A bucket is stored as "tokens at an instant" rather than as a list of timestamps: one row
 * of two numbers per actor, whatever the traffic, and no window edge for a caller to line up
 * against.
 */
const SECONDS_PER_MINUTE = 60;

export type BucketState = Readonly<{
  tokens: number;
  updatedAt: Date;
}>;

/** A bucket nobody has spent from yet. Full, so a first request is never the one refused. */
export function fullBucket(policy: RateLimitPolicy, now: Date): BucketState {
  return { tokens: policy.burst, updatedAt: now };
}

/**
 * The bucket as it stands now, having refilled since it was last touched.
 *
 * Clamped at `burst`, so an actor that went quiet for a day gets a full bucket and not a day's
 * worth of credit. Time running backwards — an NTP correction, a clock the caller controls —
 * refills nothing rather than draining: the store supplies `now` from the database precisely
 * so this stays a same-source comparison.
 */
export function refill(state: BucketState, policy: RateLimitPolicy, now: Date): BucketState {
  const elapsedMs = now.getTime() - state.updatedAt.getTime();
  if (elapsedMs <= 0) return { tokens: state.tokens, updatedAt: now };

  const refilled = (elapsedMs / 1000) * (policy.refillPerMinute / SECONDS_PER_MINUTE);
  return { tokens: Math.min(policy.burst, state.tokens + refilled), updatedAt: now };
}

/**
 * Spend one token, or say how long until there is one.
 *
 * Returns the decision *and* the state to store, so a caller cannot record a spend it did not
 * make. A refused request costs nothing: a client hammering a spent bucket does not push its
 * own recovery further away, which is what turns a rate limit into a lockout.
 */
export function consume(
  state: BucketState,
  policy: RateLimitPolicy,
  now: Date,
): Readonly<{ decision: RateLimitDecision; next: BucketState }> {
  const current = refill(state, policy, now);

  if (current.tokens < 1) {
    return {
      decision: { allowed: false, retryAfterSeconds: secondsUntilNextToken(current, policy) },
      next: current,
    };
  }

  const next = { tokens: current.tokens - 1, updatedAt: now };
  return { decision: { allowed: true, remaining: Math.floor(next.tokens) }, next };
}

function secondsUntilNextToken(state: BucketState, policy: RateLimitPolicy): number {
  // A policy that refills nothing would divide by zero and, worse, promise a retry that never
  // comes. Config forbids it; this keeps the arithmetic total anyway.
  if (policy.refillPerMinute <= 0) return SECONDS_PER_MINUTE;
  return ((1 - state.tokens) / policy.refillPerMinute) * SECONDS_PER_MINUTE;
}
