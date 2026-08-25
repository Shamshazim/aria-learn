import { z } from 'zod';

import { ServiceUnavailableError } from '@/errors';

import { createSupabaseHttp } from './supabase.http';

import type { TokenVerifier } from './jwt';
import type { SupabaseHttp, SupabaseHttpConfig } from './supabase.http';
import type { AdultIdentityProvider, MagicLinkRequest, VerifiedAdultToken } from './types';

/**
 * Supabase Auth (GoTrue) behind Aria's port — the vendor half of the P0-26 decision.
 *
 * Read the four methods as the whole of what Aria sends this vendor: an adult email, an adult
 * access token, and an adult subject. That is the entire outbound surface, and a boundary test
 * drives the full parent-and-child flow through a recording fake to prove nothing else joins
 * it (`identity-boundary.test.ts`).
 *
 * Verification is deliberately local. Asking GoTrue to validate every request would put a
 * network round trip in front of every page a parent opens; `assertLiveSession` is the same
 * question asked over the wire, and it runs only where P0-26 requires a fresh answer.
 */
const ENDPOINTS = {
  magicLink: '/auth/v1/otp',
  user: '/auth/v1/user',
  adminUser: (subject: string) => `/auth/v1/admin/users/${encodeURIComponent(subject)}`,
} as const;

/** GoTrue returns a great deal about a user. Aria reads the id, and nothing else. */
const liveUserSchema = z.object({ id: z.string().min(1) });

export type SupabaseProviderDeps = Readonly<{
  http: SupabaseHttp;
  verifier: TokenVerifier;
}>;

export function createSupabaseProvider(deps: SupabaseProviderDeps): AdultIdentityProvider {
  const { http, verifier } = deps;

  return {
    name: 'supabase',

    async sendMagicLink(request: MagicLinkRequest): Promise<void> {
      await http.call({
        path: ENDPOINTS.magicLink,
        method: 'POST',
        body: {
          email: request.email,
          ...(request.redirectTo === undefined ? {} : { redirect_to: request.redirectTo }),
        },
      });
    },

    // Local and synchronous underneath, but the port is async: a JWKS verifier fetches keys,
    // and a port whose shape depends on which adapter implements it is not a port.
    verifyAccessToken(token: string): Promise<VerifiedAdultToken> {
      return Promise.resolve(verifier.verify(token));
    },

    async assertLiveSession(token: string): Promise<void> {
      const body = await http.call({ path: ENDPOINTS.user, method: 'GET', bearer: token });

      // A 401 has already thrown. A null body here means GoTrue answered 404 for a user it
      // no longer has — deleted between the token being signed and this check.
      if (!liveUserSchema.safeParse(body).success) {
        throw new ServiceUnavailableError('identity provider returned no live user for the token');
      }
    },

    async deleteUser(subject: string): Promise<void> {
      // `should_soft_delete` is left at its default of false. "Delete means delete"
      // (master-plan.md §12.9) does not admit a vendor-side tombstone.
      await http.call({ path: ENDPOINTS.adminUser(subject), method: 'DELETE', admin: true });
    },
  };
}

export type SupabaseProviderConfig = SupabaseHttpConfig & Readonly<{ verifier: TokenVerifier }>;

/** Assembles the adapter from configuration, so composition roots do not wire GoTrue by hand. */
export function buildSupabaseProvider(config: SupabaseProviderConfig): AdultIdentityProvider {
  const { verifier, ...http } = config;
  return createSupabaseProvider({ http: createSupabaseHttp(http), verifier });
}
