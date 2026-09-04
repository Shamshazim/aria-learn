import type { ActorClass } from './rate-limit';

/**
 * The vocabulary of "this request already happened" (X-05). Declarations only.
 *
 * A child on a slow connection taps an answer twice; a phone retries a POST whose response it
 * never saw. Without a record of the first attempt the second one runs the turn again — a
 * second model call, a second `session_event`, and a tutor that has moved on from the question
 * the child is still looking at.
 */
export type IdempotencyKey = Readonly<{
  key: string;
  actorClass: ActorClass;
  actorId: string;
  /** Method and path, so the same key on a different route is a different request. */
  route: string;
}>;

/** What the first attempt produced, kept only long enough for a retry to find it. */
export type StoredResponse = Readonly<{
  statusCode: number;
  body: unknown;
}>;

/**
 * The outcome of trying to claim a key.
 *
 * A discriminated union rather than a nullable record, because the three cases need three
 * different answers and a caller that forgets one is a caller that replays a stranger's
 * response or re-runs a turn.
 */
export type IdempotencyClaim =
  /** Nobody has this key: the caller owns it and must record what it produced. */
  | Readonly<{ status: 'claimed' }>
  /** The first attempt finished. Its response is replayed verbatim. */
  | Readonly<{ status: 'replay'; response: StoredResponse }>
  /** The first attempt is still running. Duplicating it is the thing we are preventing. */
  | Readonly<{ status: 'in-flight' }>
  /** Same key, different body. A client bug, and never served the other body's answer. */
  | Readonly<{ status: 'mismatch' }>;

export type IdempotencyRepository = Readonly<{
  /** Atomically claims the key, or reports who already holds it. */
  claim(key: IdempotencyKey, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim>;
  /** Records what the claimed attempt produced, so a retry has something to replay. */
  complete(key: IdempotencyKey, response: StoredResponse): Promise<void>;
  /**
   * Releases a claim that produced nothing to replay — a crash, or a 5xx. Without it a key
   * whose first attempt failed would be stuck reporting `in-flight` until it expired, and the
   * client's honest retry would never run.
   */
  release(key: IdempotencyKey): Promise<void>;
  /** Drops expired rows. Nothing here is meant to outlive the retry it exists for. */
  deleteExpired(now: Date): Promise<number>;
}>;
