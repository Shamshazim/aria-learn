import type { IdentityProviderName } from '@/types/identity';

/**
 * The identity-provider port.
 *
 * Aria owns this interface; a vendor implements it. Everything above this line reasons about
 * an *adult subject* and nothing else — which is what makes the boundary in `master-plan.md`
 * §12.2 checkable rather than aspirational. There is no method here that could carry a child
 * nickname, grade, transcript or id, so no service can accidentally send one.
 *
 * The split between `verifyAccessToken` and `assertLiveSession` is the ticket's cost rule.
 * Verification is local and cryptographic, so every authenticated request can afford it;
 * asking the vendor whether the session is still live is a network round trip and happens
 * only where P0-26 requires a fresh check — the sensitive parent actions.
 */
export type VerifiedAdultToken = Readonly<{
  /** The vendor's opaque id for this adult. The only identifier Aria stores from them. */
  subject: string;
  /** The provider session this token belongs to. Aria keys its own revocation on it. */
  sessionId: string;
  email: string;
  expiresAt: Date;
}>;

export type MagicLinkRequest = Readonly<{
  email: string;
  /** Where the provider should send the adult back to. Never contains a child identifier. */
  redirectTo?: string;
}>;

export type AdultIdentityProvider = Readonly<{
  name: IdentityProviderName;

  /** Starts a login. The only outbound call carrying an adult's email. */
  sendMagicLink(request: MagicLinkRequest): Promise<void>;

  /**
   * Verifies the token's signature and claims locally. Throws `UnauthenticatedError` for any
   * token Aria will not honour, and never says which claim failed.
   */
  verifyAccessToken(token: string): Promise<VerifiedAdultToken>;

  /** Confirms with the vendor that the session behind this token still exists. */
  assertLiveSession(token: string): Promise<void>;

  /**
   * Hard-deletes the adult at the vendor. Idempotent: a subject that is already gone is a
   * success, because the deletion orchestrator retries and must be able to finish.
   */
  deleteUser(subject: string): Promise<void>;
}>;
