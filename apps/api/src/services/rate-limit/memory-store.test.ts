import { describe, expect, it } from 'vitest';

import type { RateLimitKey, RateLimitPolicy } from '@/types/rate-limit';

import { createMemoryRateLimitStore } from './memory-store';

const POLICY: RateLimitPolicy = { burst: 3, refillPerMinute: 60 };
const START = new Date('2026-09-03T10:00:00.000Z');

function key(overrides: Partial<RateLimitKey> = {}): RateLimitKey {
  return { actorClass: 'student', actorId: 'child-a', routeClass: 'turn', ...overrides };
}

async function spendAll(
  store: ReturnType<typeof createMemoryRateLimitStore>,
  of: RateLimitKey,
): Promise<void> {
  for (let i = 0; i < POLICY.burst; i += 1) await store.consume(of, POLICY, START);
}

describe('memory rate limit store', () => {
  it('refuses once the burst is spent, and says when to retry', async () => {
    const store = createMemoryRateLimitStore();
    await spendAll(store, key());

    expect(await store.consume(key(), POLICY, START)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  /** The bucket that matters most: one child must not be able to spend another's budget. */
  it('gives each actor its own bucket', async () => {
    const store = createMemoryRateLimitStore();
    await spendAll(store, key());

    expect(await store.consume(key({ actorId: 'child-b' }), POLICY, START)).toMatchObject({
      allowed: true,
    });
  });

  /** A child reading their progress must not exhaust the budget that lets them answer. */
  it('gives each route class its own bucket', async () => {
    const store = createMemoryRateLimitStore();
    await spendAll(store, key());

    expect(await store.consume(key({ routeClass: 'read' }), POLICY, START)).toMatchObject({
      allowed: true,
    });
  });

  it('lets a refused actor back in once the bucket has refilled', async () => {
    const store = createMemoryRateLimitStore();
    await spendAll(store, key());
    const later = new Date(START.getTime() + 60_000);

    expect(await store.consume(key(), POLICY, later)).toMatchObject({ allowed: true });
  });

  /**
   * The map is swept on size, so a long-lived process does not accumulate a bucket for every
   * address that ever arrived. A swept bucket is a full one, so no decision changes.
   */
  it('stays bounded across many distinct actors without refusing any of them', async () => {
    const store = createMemoryRateLimitStore({ sweepAfterEntries: 8 });
    const decisions = [];

    for (let i = 0; i < 20; i += 1) {
      decisions.push(await store.consume(key({ actorId: `child-${String(i)}` }), POLICY, START));
    }

    expect(decisions.every((decision) => decision.allowed)).toBe(true);
  });

  /**
   * A swept bucket must be indistinguishable from one that was never there. If the sweep
   * dropped a bucket that still had a spend recorded against it, an actor would get their
   * burst back early — which is the one way this optimisation could change a decision.
   */
  it('never returns budget to an actor whose bucket is swept', async () => {
    const store = createMemoryRateLimitStore({ sweepAfterEntries: 4 });
    await spendAll(store, key());

    for (let i = 0; i < 20; i += 1) {
      await store.consume(key({ actorId: `other-${String(i)}` }), POLICY, START);
    }

    expect(await store.consume(key(), POLICY, START)).toMatchObject({ allowed: false });
  });
});
