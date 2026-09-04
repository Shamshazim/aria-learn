import type {
  RateLimitDecision,
  RateLimitKey,
  RateLimitPolicy,
  RateLimitStore,
} from '@/types/rate-limit';

import { consume, fullBucket, refill, type BucketState } from './token-bucket';

/**
 * Bucket state in this process (X-05).
 *
 * The right adapter for a single instance, for every test, and for local development. It is
 * also the honest default: a limiter that silently needed a database would be one more thing
 * that works on a laptop and fails in a deployment.
 *
 * Its limitation is worth stating plainly — with N instances behind a load balancer each one
 * holds its own buckets, so the effective limit is N times the configured one. That is a
 * ceiling that still stops a runaway loop, and `createPostgresRateLimitStore` is the answer
 * where the exact number matters.
 */
const SWEEP_AFTER_ENTRIES = 10_000;

/**
 * `sweepAfterEntries` exists so the sweep can be tested at a threshold that does not cost ten
 * thousand iterations in a suite that runs on every commit. Production never passes it.
 */
export function createMemoryRateLimitStore(
  options?: Readonly<{ sweepAfterEntries?: number }>,
): RateLimitStore {
  const buckets = new Map<string, BucketState>();
  const threshold = options?.sweepAfterEntries ?? SWEEP_AFTER_ENTRIES;

  return {
    consume: (key, policy, now) =>
      Promise.resolve(consumeFrom({ buckets, id: keyOf(key), policy, now, threshold })),
  };
}

function consumeFrom(
  input: Readonly<{
    buckets: Map<string, BucketState>;
    id: string;
    policy: RateLimitPolicy;
    now: Date;
    threshold: number;
  }>,
): RateLimitDecision {
  const { buckets, id, policy, now, threshold } = input;
  const state = buckets.get(id) ?? fullBucket(policy, now);
  const { decision, next } = consume(state, policy, now);

  buckets.set(id, next);
  if (buckets.size > threshold) sweepFull(buckets, policy, now);
  return decision;
}

/**
 * Forget the buckets that have refilled to full.
 *
 * Without this the map is a slow leak: every anonymous address that ever arrived stays in it
 * for the life of the process. A full bucket is indistinguishable from an absent one — both
 * mean "this actor has spent nothing recently" — so dropping it changes no decision.
 *
 * Swept on a size threshold rather than on a timer: a timer would keep an idle process awake
 * and would have to be stopped by every test that built a store.
 */
function sweepFull(buckets: Map<string, BucketState>, policy: RateLimitPolicy, now: Date): void {
  for (const [id, state] of buckets) {
    if (refill(state, policy, now).tokens >= policy.burst) buckets.delete(id);
  }
}

/**
 * The actor and the route class together. Two students never share a bucket, and neither do
 * a student's turns and their reads — a child reading their own progress cannot exhaust the
 * budget that lets them answer a question.
 */
function keyOf(key: RateLimitKey): string {
  return `${key.actorClass}:${key.actorId}:${key.routeClass}`;
}
