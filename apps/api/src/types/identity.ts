/**
 * The adult half of the identity domain: who the provider says an adult is, what Aria knows
 * about them, and what makes their session live.
 *
 * Declarations only (CODE-STANDARDS §3.1). Nothing here imports a vendor SDK or a driver;
 * `provider` is a string in the domain because the domain does not care which vendor it was,
 * only that it was recorded.
 */

export const ADULT_ROLES = ['parent', 'teacher'] as const;
export type AdultRole = (typeof ADULT_ROLES)[number];

export const IDENTITY_PROVIDERS = ['supabase', 'fake'] as const;
export type IdentityProviderName = (typeof IDENTITY_PROVIDERS)[number];

/**
 * Verifiable parental consent, in the two forms the FTC accepts and this product can supply.
 * A teacher's `authorised_school` consent is a school's, not an individual teacher's: a
 * teacher account is never silently treated as parental consent (rewrite.md §6).
 */
export const CONSENT_METHODS = ['monetary_transaction', 'authorised_school'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export type AdultIdentity = {
  id: string;
  role: AdultRole;
  provider: IdentityProviderName;
  providerSubject: string;
  /** Set for a parent and only for a parent. A teacher owns no children. */
  parentId: string | null;
  attestedAdultAt: Date;
  createdAt: Date;
};

export type NewAdultIdentity = {
  role: AdultRole;
  provider: IdentityProviderName;
  providerSubject: string;
  parentId: string | null;
  attestedAdultAt: Date;
};

export type ConsentRecord = {
  id: string;
  adultId: string;
  method: ConsentMethod;
  /** The payment or school-agreement reference that makes the consent verifiable. */
  sourceReference: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
};

export type AdultSession = {
  id: string;
  adultId: string;
  providerSessionId: string;
  createdAt: Date;
  lastSeenAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};

/**
 * What the adult auth middleware attaches to a request once it has proven all three things a
 * request needs: a signed provider token, an Aria identity row, and a live Aria session.
 */
export type AdultActor = {
  adultId: string;
  role: AdultRole;
  /** Present exactly when `role` is `'parent'`. */
  parentId: string | null;
  sessionId: string;
  providerSubject: string;
  /** True when the provider was re-checked on this request (sensitive actions only). */
  freshlyVerified: boolean;
};
