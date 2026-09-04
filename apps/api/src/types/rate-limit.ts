import type { RequestHandler } from 'express';

/**
 * The vocabulary of rate limiting (X-05). Declarations only — no behaviour.
 *
 * Nothing in the system limited anything before this ticket: a stuck retry loop, a script
 * pointed at the child login, or a worker reconnecting in a tight circle all had the whole
 * API to themselves. What follows is deliberately small — a bucket, an actor, a policy — so
 * that adding a limit is a line of configuration rather than a new mechanism.
 */

/**
 * Who is spending the budget.
 *
 * Keyed by *who*, never by where they are. A shared school NAT puts thirty families behind
 * one address, so an address is not an actor; `anonymous` is the only class that has to fall
 * back to one, and its limits are set loose enough that a classroom signing in together does
 * not trip them (X-05 "do not build").
 */
export const ACTOR_CLASSES = ['student', 'parent', 'device', 'worker', 'anonymous'] as const;

export type ActorClass = (typeof ACTOR_CLASSES)[number];

/**
 * What is being spent on.
 *
 * A class rather than a path, because limits are a product decision about kinds of work —
 * "a turn costs a model call", "a sign-in attempt is cheap but guessable" — and pinning them
 * to paths means every new route silently arrives unlimited.
 */
export const ROUTE_CLASSES = ['turn', 'session', 'read', 'auth', 'mutation'] as const;

export type RouteClass = (typeof ROUTE_CLASSES)[number];

/**
 * A token bucket, as configuration.
 *
 * `burst` is what a bucket holds when full and `refillPerMinute` is how fast it comes back,
 * which together say the two things a limit has to say: how much at once, and how much
 * sustained. A child tapping an answer twice spends burst; a loop spends the refill rate.
 */
export type RateLimitPolicy = Readonly<{
  burst: number;
  refillPerMinute: number;
}>;

/** The identity a bucket belongs to. One bucket per actor per route class. */
export type RateLimitKey = Readonly<{
  actorClass: ActorClass;
  /** The actor's own id — a student id, a parent id, a grant id, an address for anonymous. */
  actorId: string;
  routeClass: RouteClass;
}>;

export type RateLimitDecision =
  | Readonly<{ allowed: true; remaining: number }>
  | Readonly<{ allowed: false; retryAfterSeconds: number }>;

/**
 * Where bucket state lives.
 *
 * A port with two adapters, because the honest answer differs by deployment: one process
 * wants a map, and several processes behind a load balancer want a row they can all see.
 * `consume` is a single call rather than read-then-write so that the Postgres adapter can
 * make it one atomic statement — two instances spending the last token at once is precisely
 * the case a limiter exists to get right.
 */
export type RateLimitStore = Readonly<{
  consume(key: RateLimitKey, policy: RateLimitPolicy, now: Date): Promise<RateLimitDecision>;
}>;

/**
 * How a router asks for a limit.
 *
 * Routers receive this rather than the store itself, so that wiring stays wiring: a router
 * names the *kind* of work a path does and knows nothing about buckets, policies or where
 * their state lives.
 */
export type RateLimiter = (
  routeClass: RouteClass,
  options?: Readonly<{ actorClass?: ActorClass }>,
) => RequestHandler;
