import { policyFor } from '@/config/rate-limit';
import { RateLimitedError } from '@/errors';
import type {
  ActorClass,
  RateLimiter,
  RateLimitKey,
  RateLimitStore,
  RouteClass,
} from '@/types/rate-limit';

import type { Request, RequestHandler } from 'express';

/**
 * Spend one token before the controller runs (X-05).
 *
 * Mounted per route class rather than once at the top of the app, because the actor is only
 * known after that route's own authentication has run: a student route knows a student id, and
 * the same middleware in front of everything would see `anonymous` for all of them and bill a
 * whole school to one bucket.
 *
 * It fails **open**. A limiter whose store is unreachable must not take the API down with it —
 * the failure it exists to prevent is expensive traffic, and refusing every child because
 * Postgres hiccuped is a worse outcome than serving a burst unmetered. The refusal is logged
 * so the silence is visible.
 */
export function rateLimit(
  store: RateLimitStore,
  routeClass: RouteClass,
  options?: Readonly<{ actorClass?: ActorClass }>,
): RequestHandler {
  return (request, _response, next): void => {
    const key = actorKeyFor(request, routeClass, options?.actorClass);

    void store
      .consume(key, policyFor(key.actorClass, routeClass), new Date())
      .then((decision) => {
        if (decision.allowed) {
          next();
          return;
        }

        // `Retry-After` is set by the error handler, from the error itself — one place, so a
        // 429 raised anywhere else still carries it.
        next(
          new RateLimitedError(
            `rate limit reached: ${key.actorClass} ${key.routeClass}`,
            decision.retryAfterSeconds,
          ),
        );
      })
      .catch((error: unknown) => {
        request.log.error({ err: error, routeClass }, 'Rate limit store unavailable; allowing');
        next();
      });
  };
}

/**
 * Who to bill, in order of how much they have proved.
 *
 * A device grant is checked before the student it opened, because the tablet is the thing with
 * a budget: a family sharing one device would otherwise get one child's allowance for all of
 * them. `anonymous` is last and is the only class keyed by an address — see `config/rate-limit`
 * for why that is deliberately loose.
 *
 * `declared` is for a route whose actor is a fact of the mounting rather than of the request:
 * the voice worker's routes sit behind `workerOnly`, so by the time this runs the token has
 * already been checked. It is never inferred from a header — an `Authorization:` anybody can
 * send would otherwise be enough to claim the worker's much larger budget.
 */
export function actorKeyFor(
  request: Request,
  routeClass: RouteClass,
  declared?: ActorClass,
): RateLimitKey {
  const identified = declared === undefined ? identify(request) : declaredActor(request, declared);
  return { ...identified, routeClass };
}

type Actor = Readonly<{ actorClass: ActorClass; actorId: string }>;

function identify(request: Request): Actor {
  if (request.deviceGrant !== undefined) {
    return { actorClass: 'device', actorId: request.deviceGrant.id };
  }
  if (request.studentId !== undefined) {
    return { actorClass: 'student', actorId: request.studentId };
  }
  if (request.parent !== undefined) {
    return { actorClass: 'parent', actorId: request.parent.id };
  }
  return { actorClass: 'anonymous', actorId: addressOf(request) };
}

/**
 * A declared class still needs an id. The worker fleet shares one — the limit on it is a
 * circuit breaker on our own reconnect loops, not a defence against ourselves — while any
 * other declaration falls back to whatever the request actually proved.
 */
function declaredActor(request: Request, declared: ActorClass): Actor {
  if (declared === 'worker') return { actorClass: 'worker', actorId: 'voice-worker' };
  const identified = identify(request);
  return identified.actorClass === declared
    ? identified
    : { actorClass: declared, actorId: addressOf(request) };
}

/**
 * The caller's address, and nothing derived from it beyond this bucket.
 *
 * `request.ip` honours Express's `trust proxy` setting; where none is configured it is the
 * socket address, which behind a load balancer is the balancer itself. That collapses every
 * anonymous caller onto one bucket, so the anonymous limits are sized to survive it.
 */
function addressOf(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

/**
 * One store, bound once, handed to the routers as the `RateLimiter` they ask for.
 *
 * Built in the composition root so that swapping the memory adapter for the Postgres one is a
 * single line there and invisible everywhere else (CODE-STANDARDS §3.1).
 */
export function createRateLimiter(store: RateLimitStore): RateLimiter {
  return (routeClass, options) => rateLimit(store, routeClass, options);
}
