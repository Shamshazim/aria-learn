import type {
  IdempotencyClaim,
  IdempotencyKey,
  IdempotencyRepository,
  StoredResponse,
} from '@/types/idempotency';

/**
 * The idempotency store, in memory, for tests that are about the middleware rather than SQL.
 *
 * It reimplements the same three-way claim the Postgres repository does — first, replay, or
 * still running — so a test proving "a retry does not re-run the turn" is proving the
 * middleware's logic and not the driver's.
 */
type Record_ = { requestHash: string; response: StoredResponse | null; expiresAt: number };

export function createFakeIdempotencyRepository(
  now: () => Date = () => new Date(),
): IdempotencyRepository & Readonly<{ size: () => number }> {
  const rows = new Map<string, Record_>();

  return {
    size: () => rows.size,

    claim: (key, requestHash, ttlSeconds) => {
      const id = idOf(key);
      const existing = live(rows, id, now());

      if (existing === undefined) {
        rows.set(id, {
          requestHash,
          response: null,
          expiresAt: now().getTime() + ttlSeconds * 1000,
        });
        return Promise.resolve<IdempotencyClaim>({ status: 'claimed' });
      }
      if (existing.requestHash !== requestHash) {
        return Promise.resolve<IdempotencyClaim>({ status: 'mismatch' });
      }
      if (existing.response === null) {
        return Promise.resolve<IdempotencyClaim>({ status: 'in-flight' });
      }
      return Promise.resolve<IdempotencyClaim>({ status: 'replay', response: existing.response });
    },

    complete: (key, response) => {
      const existing = rows.get(idOf(key));
      if (existing !== undefined) existing.response = response;
      return Promise.resolve();
    },

    release: (key) => {
      const existing = rows.get(idOf(key));
      if (existing?.response === null) rows.delete(idOf(key));
      return Promise.resolve();
    },

    deleteExpired: (at) => {
      let removed = 0;
      for (const [id, row] of rows) {
        if (row.expiresAt <= at.getTime()) {
          rows.delete(id);
          removed += 1;
        }
      }
      return Promise.resolve(removed);
    },
  };
}

function live(rows: Map<string, Record_>, id: string, at: Date): Record_ | undefined {
  const row = rows.get(id);
  if (row === undefined) return undefined;
  if (row.expiresAt <= at.getTime()) {
    rows.delete(id);
    return undefined;
  }
  return row;
}

function idOf(key: IdempotencyKey): string {
  return `${key.actorClass}:${key.actorId}:${key.route}:${key.key}`;
}
