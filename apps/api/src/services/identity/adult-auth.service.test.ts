import { describe, expect, it, beforeEach } from 'vitest';

import { AppError, ERROR_CODES } from '@/errors';
import { SESSION_LIFETIMES } from '@/identity';
import { createFakeIdentityProvider } from '@/identity/provider/fake.provider';
import type { FakeIdentityProvider } from '@/identity/provider/fake.provider';
import type { AdultIdentityRepository } from '@/repositories/adult-identity.repository';
import type { AdultSessionRepository } from '@/repositories/adult-session.repository';

import {
  createFakeAdultIdentityRepository,
  createFakeAdultSessionRepository,
  resetFakeIds,
} from './__fixtures__/repositories.fake';
import { createAdultAuthService } from './adult-auth.service';

import type { AdultAuthService } from './adult-auth.service';

/**
 * The three questions every authenticated request asks, and the ways each one can answer no.
 *
 * The one worth reading first is "rejects a token whose Aria identity is gone": that is the
 * acceptance criterion about a deleted parent whose JWT has not expired, and it is the reason
 * Aria never treats a valid signature as an answer on its own.
 */
const EMAIL = 'parent@example.com';

describe('adultAuthService', () => {
  let now: Date;
  let provider: FakeIdentityProvider;
  let identities: AdultIdentityRepository;
  let sessions: AdultSessionRepository;
  let service: AdultAuthService;

  beforeEach(() => {
    resetFakeIds();
    now = new Date('2026-08-24T12:00:00.000Z');
    provider = createFakeIdentityProvider(() => now);
    identities = createFakeAdultIdentityRepository();
    sessions = createFakeAdultSessionRepository();

    service = createAdultAuthService({
      provider,
      identities,
      sessions,
      // The real provisioning needs a pool for its transaction; the policy under test here is
      // the auth service's, so the write is faked at the seam the auth service depends on.
      provisioning: (input) =>
        identities.insert({
          role: input.role,
          provider: input.provider,
          providerSubject: input.subject,
          parentId: input.role === 'parent' ? `parent-for-${input.subject}` : null,
          attestedAdultAt: input.at,
        }),
      clock: { now: () => now },
    });
  });

  function signIn(isAdult = true) {
    return service.signIn({
      accessToken: provider.issueToken(EMAIL),
      attestation: { isAdult, role: 'parent' },
    });
  }

  function expectCode(error: unknown, code: string): void {
    expect(error).toBeInstanceOf(AppError);
    if (!(error instanceof AppError)) return;
    expect(error.code).toBe(code);
  }

  describe('signIn', () => {
    it('provisions an adult on first sign-in and opens a session', async () => {
      const { actor, identity } = await signIn();

      expect(identity.role).toBe('parent');
      expect(identity.providerSubject).not.toBe(EMAIL);
      expect(actor.parentId).not.toBeNull();
      expect(actor.freshlyVerified).toBe(false);
    });

    it('reuses the identity on a second sign-in rather than creating another', async () => {
      const first = await signIn();
      const second = await signIn();

      expect(second.identity.id).toBe(first.identity.id);
    });

    it('creates nothing at all when the visitor does not attest to being an adult', async () => {
      await expect(signIn(false)).rejects.toThrow(AppError);
      await expect(
        identities.findBySubject(
          'fake',
          (await provider.verifyAccessToken(provider.issueToken(EMAIL))).subject,
        ),
      ).resolves.toBeNull();
    });
  });

  describe('authenticate', () => {
    it('accepts a live session and records the activity', async () => {
      const token = provider.issueToken(EMAIL);
      await service.signIn({ accessToken: token, attestation: { isAdult: true, role: 'parent' } });

      now = new Date(now.getTime() + 60_000);
      const { actor } = await service.authenticate(token);

      const session = await sessions.findByProviderSessionId(
        'fake-session-' + actor.providerSubject.slice(0, 8),
      );
      expect(session?.lastSeenAt).toEqual(now);
    });

    it('rejects a token whose Aria identity is gone, even though the token still verifies', async () => {
      const token = provider.issueToken(EMAIL);
      const { identity } = await service.signIn({
        accessToken: token,
        attestation: { isAdult: true, role: 'parent' },
      });

      // The provider is untouched: the token still has a valid signature and an unexpired
      // `exp`. What is gone is Aria's row, which is what deletion removes first.
      const scrubbed = createFakeAdultIdentityRepository();
      const afterDeletion = createAdultAuthService({
        provider,
        identities: scrubbed,
        sessions,
        provisioning: () => Promise.reject(new Error('must not provision')),
        clock: { now: () => now },
      });

      const error = await afterDeletion.authenticate(token).catch((thrown: unknown) => thrown);
      expectCode(error, ERROR_CODES.UNAUTHENTICATED);
      expect(identity.id).toBeDefined();
    });

    it('rejects a revoked session immediately, without waiting for the token to expire', async () => {
      const token = provider.issueToken(EMAIL);
      const { actor } = await service.signIn({
        accessToken: token,
        attestation: { isAdult: true, role: 'parent' },
      });

      await service.signOut(actor.sessionId);

      await expect(service.authenticate(token)).rejects.toThrow(AppError);
    });

    it('rejects a session that has been idle past the inactivity window', async () => {
      const token = provider.issueToken(EMAIL, {
        expiresAt: new Date(now.getTime() + 60 * 86_400_000),
      });
      await service.signIn({ accessToken: token, attestation: { isAdult: true, role: 'parent' } });

      now = new Date(now.getTime() + SESSION_LIFETIMES.adultIdleMs + 1);
      await expect(service.authenticate(token)).rejects.toThrow(AppError);
    });

    it('rejects a session past its absolute lifetime however recently it was used', async () => {
      const token = provider.issueToken(EMAIL, {
        expiresAt: new Date(now.getTime() + 60 * 86_400_000),
      });
      await service.signIn({ accessToken: token, attestation: { isAdult: true, role: 'parent' } });

      // Kept warm right up to the deadline, then crossed it.
      for (let day = 1; day <= 30; day += 1) {
        now = new Date(now.getTime() + 86_400_000);
        if (day < 30) await service.authenticate(token);
      }

      await expect(service.authenticate(token)).rejects.toThrow(AppError);
    });

    it('asks the provider only when a fresh verification is requested', async () => {
      const token = provider.issueToken(EMAIL);
      await service.signIn({ accessToken: token, attestation: { isAdult: true, role: 'parent' } });

      await service.authenticate(token);
      expect(provider.calls.filter((call) => call.method === 'assertLiveSession')).toHaveLength(0);

      const { actor } = await service.authenticate(token, { fresh: true });
      expect(provider.calls.filter((call) => call.method === 'assertLiveSession')).toHaveLength(1);
      expect(actor.freshlyVerified).toBe(true);
    });
  });
});
