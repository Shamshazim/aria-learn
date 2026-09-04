import { describe, expect, it } from 'vitest';

import type { RateLimitPolicy } from '@/types/rate-limit';

import { consume, fullBucket, refill } from './token-bucket';

/**
 * The limit's arithmetic, held to what the policies in `config/rate-limit` promise.
 *
 * Time is a parameter here rather than a clock to stub: the bucket is pure, so a test can say
 * "a minute later" without waiting for one.
 */
const POLICY: RateLimitPolicy = { burst: 10, refillPerMinute: 60 };
const START = new Date('2026-09-03T10:00:00.000Z');

function at(secondsFromStart: number): Date {
  return new Date(START.getTime() + secondsFromStart * 1000);
}

describe('token bucket', () => {
  it('starts full, so a first request is never the one refused', () => {
    const decision = consume(fullBucket(POLICY, START), POLICY, START).decision;

    expect(decision).toEqual({ allowed: true, remaining: 9 });
  });

  it('spends one token per request until the burst is gone', () => {
    let state = fullBucket(POLICY, START);
    const outcomes = Array.from({ length: POLICY.burst }, () => {
      const result = consume(state, POLICY, START);
      state = result.next;
      return result.decision.allowed;
    });

    expect(outcomes).toEqual(Array.from({ length: POLICY.burst }, () => true));
    expect(consume(state, POLICY, START).decision.allowed).toBe(false);
  });

  it('refills at the configured rate and no faster', () => {
    // A whole burst spent at once, then one second of a 60-per-minute refill: exactly one token.
    const spent = { tokens: 0, updatedAt: START };

    expect(refill(spent, POLICY, at(1)).tokens).toBeCloseTo(1);
    expect(refill(spent, POLICY, at(5)).tokens).toBeCloseTo(5);
  });

  it('never refills past the burst, however long an actor was away', () => {
    const spent = { tokens: 0, updatedAt: START };

    expect(refill(spent, POLICY, at(86_400)).tokens).toBe(POLICY.burst);
  });

  it('tells a refused caller when to come back', () => {
    const decision = consume({ tokens: 0, updatedAt: START }, POLICY, START).decision;

    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('does not charge a refused request, so hammering cannot push recovery away', () => {
    const spent = { tokens: 0, updatedAt: START };
    const once = consume(spent, POLICY, START);
    const twice = consume(once.next, POLICY, START);

    expect(twice.next.tokens).toBe(once.next.tokens);
    expect(twice.decision).toEqual(once.decision);
  });

  /**
   * An NTP correction, or a virtual machine resuming, can move the clock backwards. Refilling
   * on a negative interval would drain a bucket nobody spent from.
   */
  it('refills nothing when time runs backwards', () => {
    const state = { tokens: 4, updatedAt: at(60) };

    expect(refill(state, POLICY, START).tokens).toBe(4);
  });

  it('grants a whole burst again after the bucket has fully refilled', () => {
    let state: ReturnType<typeof fullBucket> = { tokens: 0, updatedAt: START };
    state = refill(state, POLICY, at(60));

    expect(state.tokens).toBe(POLICY.burst);
    expect(consume(state, POLICY, at(60)).decision.allowed).toBe(true);
  });
});
