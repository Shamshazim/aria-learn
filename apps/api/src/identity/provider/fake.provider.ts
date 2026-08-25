import { createHash } from 'node:crypto';

import { UnauthenticatedError } from '@/errors';

import type { AdultIdentityProvider, MagicLinkRequest, VerifiedAdultToken } from './types';

/**
 * An in-process identity provider, for tests and for local development.
 *
 * The ticket asks that the normal test suite need no live credentials and that provider calls
 * be integration-tested against a local fake, so this is faked at the port rather than at
 * `fetch` (CODE-STANDARDS §6): a network mock would only prove that our URLs match
 * themselves, while this exercises every service above the port exactly as production does.
 *
 * It records every call, which is what makes the boundary test possible — that test drives a
 * complete parent-and-child flow and then asserts no child field appears anywhere in `calls`.
 */
export type FakeProviderCall =
  | Readonly<{ method: 'sendMagicLink'; email: string; redirectTo: string | undefined }>
  | Readonly<{ method: 'verifyAccessToken'; token: string }>
  | Readonly<{ method: 'assertLiveSession'; token: string }>
  | Readonly<{ method: 'deleteUser'; subject: string }>;

export type FakeIdentityProvider = AdultIdentityProvider &
  Readonly<{
    /** Every outbound call, in order. The boundary test reads this. */
    calls: readonly FakeProviderCall[];
    /**
     * The token an adult would come back with after following a magic link. Deterministic, so
     * a test can sign in the same adult twice and get the same subject.
     */
    issueToken(email: string, options?: Readonly<{ sessionId?: string; expiresAt?: Date }>): string;
    /** Hard-deletes at the fake, so a later verification fails the way a real deletion does. */
    deletedSubjects: readonly string[];
  }>;

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/** Deterministic and opaque, the way a real subject is. Never derived from anything child-side. */
function subjectFor(email: string): string {
  return createHash('sha256').update(`fake-subject:${email}`).digest('hex').slice(0, 32);
}

type FakeToken = { subject: string; email: string; sessionId: string; expiresAt: number };

export function createFakeIdentityProvider(
  now: () => Date = () => new Date(),
): FakeIdentityProvider {
  const calls: FakeProviderCall[] = [];
  const tokens = new Map<string, FakeToken>();
  const deleted = new Set<string>();

  function decode(token: string): FakeToken {
    const decoded = tokens.get(token);
    if (decoded === undefined) throw new UnauthenticatedError('fake token is not recognised');
    if (decoded.expiresAt < now().getTime()) {
      throw new UnauthenticatedError('fake token has expired');
    }
    return decoded;
  }

  return {
    name: 'fake',
    calls,

    get deletedSubjects() {
      return [...deleted];
    },

    issueToken: (email, options = {}) => issueToken(tokens, now, email, options),

    sendMagicLink(request: MagicLinkRequest): Promise<void> {
      calls.push({ method: 'sendMagicLink', email: request.email, redirectTo: request.redirectTo });
      return Promise.resolve();
    },

    verifyAccessToken(token: string): Promise<VerifiedAdultToken> {
      calls.push({ method: 'verifyAccessToken', token });
      const decoded = decode(token);
      return Promise.resolve({
        subject: decoded.subject,
        sessionId: decoded.sessionId,
        email: decoded.email,
        expiresAt: new Date(decoded.expiresAt),
      });
    },

    assertLiveSession(token: string): Promise<void> {
      calls.push({ method: 'assertLiveSession', token });
      if (deleted.has(decode(token).subject)) {
        throw new UnauthenticatedError('fake subject has been deleted');
      }
      return Promise.resolve();
    },

    deleteUser(subject: string): Promise<void> {
      calls.push({ method: 'deleteUser', subject });
      deleted.add(subject);
      return Promise.resolve();
    },
  };
}

function issueToken(
  tokens: Map<string, FakeToken>,
  now: () => Date,
  email: string,
  options: Readonly<{ sessionId?: string; expiresAt?: Date }>,
): string {
  const subject = subjectFor(email);
  const sessionId = options.sessionId ?? `fake-session-${subject.slice(0, 8)}`;
  const token = `fake.${subject}.${sessionId}.${String(tokens.size)}`;

  tokens.set(token, {
    subject,
    email,
    sessionId,
    expiresAt: (options.expiresAt ?? new Date(now().getTime() + DEFAULT_TTL_MS)).getTime(),
  });

  return token;
}
