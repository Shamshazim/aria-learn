import type { AdultIdentityRepository } from '@/repositories/adult-identity.repository';
import type { AdultSessionRepository } from '@/repositories/adult-session.repository';
import type { AdultIdentity, AdultSession, ConsentRecord } from '@/types/identity';

/**
 * In-memory repositories, for the service tests.
 *
 * The services are where the policy lives — which token is honoured, when a session stops
 * being live, what order a deletion happens in — and none of that is a claim about Postgres.
 * The claims that *are* about Postgres (cascades, partial indexes, atomic counters) are tested
 * against a real database in `test/`, where a fake would only prove it agrees with itself.
 *
 * `withDb` returns the same instance: a fake has no connection to re-point.
 */
let counter = 0;

function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter)}`;
}

export function resetFakeIds(): void {
  counter = 0;
}

export function createFakeAdultIdentityRepository(): AdultIdentityRepository {
  const identities: AdultIdentity[] = [];
  const consents: ConsentRecord[] = [];

  const repository: AdultIdentityRepository = {
    withDb: () => repository,

    insert: (input) => {
      const identity: AdultIdentity = { id: nextId('adult'), createdAt: new Date(0), ...input };
      identities.push(identity);
      return Promise.resolve(identity);
    },

    findBySubject: (provider, subject) =>
      Promise.resolve(
        identities.find((item) => item.provider === provider && item.providerSubject === subject) ??
          null,
      ),

    findById: (id) => Promise.resolve(identities.find((item) => item.id === id) ?? null),

    requireById: async (id) => {
      const found = await repository.findById(id);
      if (found === null) throw new Error(`no adult identity ${id}`);
      return found;
    },

    findByParentId: (parentId) =>
      Promise.resolve(identities.find((item) => item.parentId === parentId) ?? null),

    recordConsent: (input) => {
      const record: ConsentRecord = {
        id: nextId('consent'),
        grantedAt: new Date(0),
        revokedAt: null,
        ...input,
      };
      consents.push(record);
      return Promise.resolve(record);
    },

    hasActiveConsent: (adultId) =>
      Promise.resolve(consents.some((item) => item.adultId === adultId && item.revokedAt === null)),

    listConsent: (adultId) => Promise.resolve(consents.filter((item) => item.adultId === adultId)),
  };

  return repository;
}

/**
 * No clock: the real repository is passed the timestamps rather than defaulting them, so the
 * fake stores exactly what it is given — see the note on `insert` in the child-session
 * repository for why the lifetime columns are not left to the database.
 */
export function createFakeAdultSessionRepository(): AdultSessionRepository {
  const sessions: AdultSession[] = [];

  const repository: AdultSessionRepository = {
    withDb: () => repository,
    upsert: (input) => Promise.resolve(upsert(sessions, input)),

    findByProviderSessionId: (providerSessionId) =>
      Promise.resolve(
        sessions.find((item) => item.providerSessionId === providerSessionId) ?? null,
      ),

    touch: (id, at) => {
      replace(sessions, id, (session) => ({ ...session, lastSeenAt: at }));
      return Promise.resolve();
    },

    listActive: (adultId, at) =>
      Promise.resolve(
        sessions.filter(
          (item) =>
            item.adultId === adultId &&
            item.revokedAt === null &&
            item.absoluteExpiresAt.getTime() > at.getTime(),
        ),
      ),

    revoke: (id, at) =>
      Promise.resolve(
        replace(sessions, id, (session) =>
          session.revokedAt === null ? { ...session, revokedAt: at } : session,
        ),
      ),

    revokeAllForAdult: (adultId, at) => {
      const live = sessions.filter((item) => item.adultId === adultId && item.revokedAt === null);
      for (const session of live) {
        replace(sessions, session.id, (item) => ({ ...item, revokedAt: at }));
      }
      return Promise.resolve(live.length);
    },
  };

  return repository;
}

function upsert(
  sessions: AdultSession[],
  input: { adultId: string; providerSessionId: string; at: Date; absoluteExpiresAt: Date },
): AdultSession {
  const existing = sessions.find((item) => item.providerSessionId === input.providerSessionId);

  if (existing !== undefined) {
    const revived: AdultSession = { ...existing, lastSeenAt: input.at, revokedAt: null };
    sessions.splice(sessions.indexOf(existing), 1, revived);
    return revived;
  }

  const session: AdultSession = {
    id: nextId('adult-session'),
    adultId: input.adultId,
    providerSessionId: input.providerSessionId,
    createdAt: input.at,
    lastSeenAt: input.at,
    absoluteExpiresAt: input.absoluteExpiresAt,
    revokedAt: null,
  };
  sessions.push(session);
  return session;
}

/** Mutates in place so every holder of the array sees the change, as a table would. */
function replace<T extends { id: string }>(
  items: T[],
  id: string,
  update: (item: T) => T,
): boolean {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return false;

  const current = items[index];
  if (current === undefined) return false;

  items.splice(index, 1, update(current));
  return true;
}
