import { createHash } from 'node:crypto';

import { ConflictError, ValidationError } from '@/errors';
import { actorKeyFor } from '@/middleware/rate-limit';
import type { IdempotencyKey, IdempotencyRepository } from '@/types/idempotency';

import type { Request, RequestHandler, Response } from 'express';

/**
 * Make a mutating request safe to send twice (X-05).
 *
 * The case this exists for is ordinary, not adversarial: a child taps "answer" and the reply
 * is slow, so they tap again. Without a record of the first attempt the second runs the whole
 * turn — a second model call, a second `session_event`, and a tutor that has moved past the
 * question still on screen. With one, the second tap receives exactly what the first produced.
 *
 * The key is required rather than optional. An optional guard is one every client eventually
 * forgets, and the request it is forgotten on is the expensive one.
 */
const TTL_SECONDS = 24 * 60 * 60;
const KEY_HEADER = 'idempotency-key';
const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 200;

export function idempotent(repository: IdempotencyRepository): RequestHandler {
  return (request, response, next): void => {
    const key = readKey(request);
    if (key === null) {
      next(new ValidationError(`${KEY_HEADER} header is required on ${request.method}`));
      return;
    }

    const identity = keyFor(request, key);
    void repository
      .claim(identity, hashOf(request.body), TTL_SECONDS)
      .then((claim) => {
        switch (claim.status) {
          case 'claimed':
            recordOnFinish(request, response, repository, identity);
            next();
            return;
          case 'replay':
            response.status(claim.response.statusCode).json(claim.response.body);
            return;
          case 'mismatch':
            // Never served the other body's answer: the two requests are different, and the
            // one thing worse than re-running a turn is answering a question nobody asked.
            next(new ValidationError(`idempotency key reused with a different body`));
            return;
          case 'in-flight':
            next(new ConflictError('idempotency key is still in flight'));
            return;
        }
      })
      .catch((error: unknown) => {
        next(error);
      });
  };
}

/**
 * Record the response once it is actually on the wire.
 *
 * `res.json` is wrapped rather than `res.end`, because the body is what has to be replayed and
 * only `json` still has it as a value. A 5xx releases the claim instead of storing it: a
 * failure is not an outcome a retry should be handed, and a client retrying a crashed request
 * is doing the right thing.
 */
function recordOnFinish(
  request: Request,
  response: Response,
  repository: IdempotencyRepository,
  identity: IdempotencyKey,
): void {
  const original = response.json.bind(response);

  // Wrapping `res.json` is how a body is captured in Express: by the time `finish` fires the
  // body is a buffer on a socket, and this middleware has to store the value. The assignment
  // is the technique, not an accident.
  // eslint-disable-next-line no-param-reassign
  response.json = (body: unknown): Response => {
    const statusCode = response.statusCode;
    const settled =
      statusCode >= 500
        ? repository.release(identity)
        : repository.complete(identity, { statusCode, body });

    // The response is not held up for the bookkeeping; a failure to record it only means a
    // retry re-runs, which is the behaviour we had before this middleware existed.
    void settled.catch((error: unknown) => {
      request.log.error({ err: error }, 'Could not record idempotent response');
    });
    return original(body);
  };
}

function readKey(request: Request): string | null {
  const header = request.headers[KEY_HEADER];
  const value = typeof header === 'string' ? header.trim() : '';
  return value.length >= MIN_KEY_LENGTH && value.length <= MAX_KEY_LENGTH ? value : null;
}

/**
 * A key belongs to its author, its route and nothing else.
 *
 * Scoping by actor is what stops one child's key colliding with another's — clients pick
 * these, and two devices generating "1" is not a hypothetical. Scoping by route stops a key
 * reused across endpoints replaying a session creation into a turn.
 */
function keyFor(request: Request, key: string): IdempotencyKey {
  const actor = actorKeyFor(request, 'mutation');
  return {
    key,
    actorClass: actor.actorClass,
    actorId: actor.actorId,
    route: `${request.method} ${request.baseUrl}${routePatternOf(request)}`,
  };
}

/**
 * The route's pattern — `/parent/children/:id` — rather than the path a caller sent.
 *
 * Two reasons. A pattern keeps this column free of the ids in a concrete URL, which is the
 * difference between a bookkeeping table and a record of what a child opened. And it is
 * stable: the same key against the same endpoint matches whichever child it names, so a
 * client that retries is served its own first attempt rather than told the route differs.
 *
 * Narrowed rather than asserted, because Express types `route` as `any` and this file sits on
 * the boundary where that becomes a real value (CODE-STANDARDS §1).
 */
function routePatternOf(request: Request): string {
  const route: unknown = request.route;
  if (typeof route !== 'object' || route === null || !('path' in route)) return request.path;

  const path: unknown = route.path;
  return typeof path === 'string' ? path : request.path;
}

/**
 * The body, hashed rather than stored.
 *
 * A body can carry a child's own words, and this table has no business holding them (P0-23).
 * A hash answers the only question asked of it — "is this the same request?" — and answers
 * nothing else.
 */
function hashOf(body: unknown): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

/**
 * Key order must not change the hash. `JSON.stringify` preserves insertion order, so the same
 * body serialised by two clients could hash differently and a legitimate retry would be
 * refused as a mismatch.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, item]) => `${JSON.stringify(name)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}
