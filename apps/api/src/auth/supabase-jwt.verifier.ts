import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';

import type { AuthConfig } from '@/config';
import { UnauthorizedError } from '@/errors';

/**
 * Proving a parent is who Supabase says they are (P0-26, P2H-12).
 *
 * We verify the token rather than ask Supabase about it: a network call on every parent
 * request would put their auth provider on our critical path, and a signature we can check
 * against a cached key set is the same guarantee without it.
 *
 * The three claims that matter are checked here and nowhere else — issuer, audience and
 * expiry — so no caller has to remember to. A token that fails any of them is a 401 with a
 * message that says nothing about which.
 */

/** Sixty seconds, as the ticket asks. A device with a slightly wrong clock is not an attack. */
const CLOCK_TOLERANCE = '60s';

/**
 * What we read out of a verified token. Supabase puts a great deal more in there; none of it
 * is ours to trust or to keep, so the schema is strict about what we take rather than
 * permissive about what arrives.
 */
const claimsSchema = z.object({
  sub: z.string().min(1).max(128),
  email: z.email().max(320).nullish(),
});

export type VerifiedParentToken = Readonly<{ supabaseUserId: string; email: string | null }>;

export type ParentTokenVerifier = Readonly<{
  verify(token: string): Promise<VerifiedParentToken>;
}>;

/**
 * The JWKS is fetched lazily and cached by `jose`, which also handles a key rotation by
 * re-fetching when it meets an unknown `kid`. One set per process, created at composition
 * time, so a request never pays for the first fetch twice.
 */
export function createSupabaseTokenVerifier(config: AuthConfig): ParentTokenVerifier {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  return {
    verify: async (token) => {
      const payload = await verifyPayload(token, jwks, config);
      const claims = claimsSchema.safeParse(payload);
      if (!claims.success) throw new UnauthorizedError('parent token is missing its subject');
      return { supabaseUserId: claims.data.sub, email: claims.data.email ?? null };
    },
  };
}

async function verifyPayload(
  token: string,
  jwks: ReturnType<typeof createRemoteJWKSet>,
  config: AuthConfig,
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: CLOCK_TOLERANCE,
    });
    return payload;
  } catch (error) {
    // The reason is worth logging and never worth returning: "expired" and "wrong signature"
    // are different facts about the holder of the token, and only one of them is their fault.
    throw new UnauthorizedError('parent token failed verification', error);
  }
}

/** `Authorization: Bearer <jwt>`, or nothing. Kept here so both middlewares parse it once. */
export function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer (?<token>[\w.\-+/=]+)$/u.exec(header);
  return match?.groups?.token ?? null;
}
