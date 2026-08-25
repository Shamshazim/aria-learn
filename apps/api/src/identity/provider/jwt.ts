import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { UnauthenticatedError } from '@/errors';

import type { VerifiedAdultToken } from './types';

/**
 * HS256 verification of a provider access token, with `node:crypto` and no JWT library.
 *
 * A JWT verifier is a small amount of code and a large amount of care, and the care is all in
 * the parts a library cannot decide for you: which algorithm is acceptable, whether `alg` in
 * the header is allowed to choose it (it is not), and which claims are checked. Writing it
 * here keeps those three answers visible in one file.
 *
 * Supabase signs with a shared HS256 secret by default. Its asymmetric (JWKS) mode is a
 * second verifier, added as a file beside this one rather than as a branch inside it
 * (CODE-STANDARDS §4) — `TokenVerifier` is the seam that makes that an addition.
 */
export type TokenVerifier = Readonly<{
  verify(token: string): VerifiedAdultToken;
}>;

/** Only the claims Aria acts on. Anything else the vendor sends is ignored, not trusted. */
const claimsSchema = z.object({
  sub: z.string().min(1),
  session_id: z.string().min(1),
  email: z.email(),
  exp: z.number().int().positive(),
  iat: z.number().int().positive().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  iss: z.string().optional(),
});

const headerSchema = z.object({ alg: z.literal('HS256'), typ: z.string().optional() });

export type Hs256VerifierOptions = Readonly<{
  secret: string;
  /** Rejected if the token's issuer differs. Undefined means the vendor sends none. */
  issuer?: string;
  audience?: string;
  now(): Date;
  /** Tolerance for clock skew between Aria and the vendor. */
  leewaySeconds?: number;
}>;

const DEFAULT_LEEWAY_SECONDS = 30;

export function createHs256Verifier(options: Hs256VerifierOptions): TokenVerifier {
  const leeway = options.leewaySeconds ?? DEFAULT_LEEWAY_SECONDS;

  return {
    verify(token) {
      const parts = token.split('.');
      const [encodedHeader, encodedPayload, encodedSignature] = parts;
      if (parts.length !== 3 || !encodedHeader || !encodedPayload || !encodedSignature) {
        throw rejected('token is not a three-part JWS');
      }

      // The header is parsed only to reject a token that claims another algorithm. It never
      // selects one: `alg: none` and algorithm-confusion attacks both die here.
      const header = headerSchema.safeParse(decodeSegment(encodedHeader));
      if (!header.success) throw rejected('token header is not HS256');

      assertSignature(`${encodedHeader}.${encodedPayload}`, encodedSignature, options.secret);

      const claims = claimsSchema.safeParse(decodeSegment(encodedPayload));
      if (!claims.success) throw rejected('token claims are missing or malformed');

      assertClaims(claims.data, options, leeway);

      return {
        subject: claims.data.sub,
        sessionId: claims.data.session_id,
        email: claims.data.email,
        expiresAt: new Date(claims.data.exp * 1000),
      };
    },
  };
}

function assertSignature(signed: string, encodedSignature: string, secret: string): void {
  const expected = createHmac('sha256', secret).update(signed).digest();
  const actual = Buffer.from(encodedSignature, 'base64url');

  // Length is compared first because `timingSafeEqual` throws on a mismatch rather than
  // returning false, and a thrown comparison would leak the length through the error path.
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw rejected('token signature does not verify');
  }
}

function assertClaims(
  claims: z.infer<typeof claimsSchema>,
  options: Hs256VerifierOptions,
  leeway: number,
): void {
  const nowSeconds = Math.floor(options.now().getTime() / 1000);

  if (claims.exp + leeway < nowSeconds) throw rejected('token has expired');
  if (claims.iat !== undefined && claims.iat - leeway > nowSeconds) {
    throw rejected('token is not yet valid');
  }
  if (options.issuer !== undefined && claims.iss !== options.issuer) {
    throw rejected('token issuer does not match');
  }
  if (options.audience !== undefined && !audienceMatches(claims.aud, options.audience)) {
    throw rejected('token audience does not match');
  }
}

function audienceMatches(claim: string | string[] | undefined, expected: string): boolean {
  if (claim === undefined) return false;
  return Array.isArray(claim) ? claim.includes(expected) : claim === expected;
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * One error for every failure above.
 *
 * The reason is written to the log and never to the response: a caller told *which* claim
 * failed has been handed a checklist for forging the next token.
 */
function rejected(reason: string): UnauthenticatedError {
  return new UnauthenticatedError(`adult token rejected — ${reason}`);
}
