import type { ActorClass, RateLimitPolicy, RouteClass } from '@/types/rate-limit';

/**
 * What each actor may spend, per route class (X-05).
 *
 * Limits are configuration, not code: a number here is reviewable on its own, and no route
 * learns its own budget. Two principles set them.
 *
 * **Generous for a child.** A limit a child can reach by hand is a bug. Nobody answers twenty
 * questions in a minute, so `turn` at twenty is far above real use and far below a loop; the
 * child who taps an answer twice spends burst and never notices. When one is reached the web
 * app shows the P0-25 calm screen, never a number.
 *
 * **Tight where guessing pays.** `auth` is the child picture-and-PIN screen and the parent
 * sign-in — the only routes where volume is itself the attack. P2H-12 already locks a child's
 * credential after repeated failures; this bounds how fast an attacker reaches that lock, and
 * bounds it for the whole address rather than one child at a time.
 */
const POLICIES: Readonly<Record<ActorClass, Readonly<Record<RouteClass, RateLimitPolicy>>>> = {
  // A signed-in child. The turn budget is the expensive one — every turn is a model call.
  student: {
    turn: { burst: 20, refillPerMinute: 20 },
    session: { burst: 10, refillPerMinute: 10 },
    read: { burst: 60, refillPerMinute: 120 },
    auth: { burst: 10, refillPerMinute: 10 },
    mutation: { burst: 30, refillPerMinute: 60 },
  },
  // A parent in the parent app: reads a digest, changes a setting, revokes a device.
  parent: {
    turn: { burst: 20, refillPerMinute: 20 },
    session: { burst: 20, refillPerMinute: 20 },
    read: { burst: 60, refillPerMinute: 120 },
    auth: { burst: 10, refillPerMinute: 10 },
    mutation: { burst: 30, refillPerMinute: 60 },
  },
  // A trusted tablet acting for the children a parent named on it. Sized for a family
  // sharing one device, not for one child.
  device: {
    turn: { burst: 40, refillPerMinute: 40 },
    session: { burst: 20, refillPerMinute: 20 },
    read: { burst: 120, refillPerMinute: 240 },
    auth: { burst: 20, refillPerMinute: 20 },
    mutation: { burst: 40, refillPerMinute: 60 },
  },
  // Our own voice worker, holding a secret we issued. Limited only so a reconnect loop
  // cannot take the API down with it — never so a real session stalls.
  worker: {
    turn: { burst: 240, refillPerMinute: 240 },
    session: { burst: 120, refillPerMinute: 120 },
    read: { burst: 600, refillPerMinute: 600 },
    auth: { burst: 60, refillPerMinute: 60 },
    mutation: { burst: 240, refillPerMinute: 240 },
  },
  // Nobody has proved anything yet, so the key is an address — and an address can be a whole
  // school behind one NAT. Loose enough for a class arriving together, tight enough that
  // guessing a PIN at machine speed is not free.
  anonymous: {
    turn: { burst: 10, refillPerMinute: 10 },
    session: { burst: 10, refillPerMinute: 10 },
    read: { burst: 60, refillPerMinute: 60 },
    auth: { burst: 30, refillPerMinute: 15 },
    mutation: { burst: 10, refillPerMinute: 10 },
  },
};

export function policyFor(actorClass: ActorClass, routeClass: RouteClass): RateLimitPolicy {
  return POLICIES[actorClass][routeClass];
}
