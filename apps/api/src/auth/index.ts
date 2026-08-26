/**
 * The identity seam (P2H-12): who is asking, and what they are allowed to be.
 *
 * Everything else in this folder is internal. A caller composes a middleware or a service
 * from here; nothing outside reaches for a verifier, a cookie helper or a hasher directly.
 */
export { requireParentAuth, requireParent } from './parent-auth.middleware';
export { requireChildSession } from './child-auth.middleware';
export { createParentIdentityService } from './parent-identity.service';
export type { ParentIdentityService } from './parent-identity.service';
export { createSupabaseTokenVerifier } from './supabase-jwt.verifier';
export type { ParentTokenVerifier, VerifiedParentToken } from './supabase-jwt.verifier';
export {
  createChildSessionService,
  CHILD_SESSION_IDLE_MS,
  CHILD_SESSION_MAX_MS,
} from './child-session.service';
export type { ChildSessionCheck, ChildSessionService } from './child-session.service';
export { createChildCredentialService, LOCK_MS, MAX_ATTEMPTS } from './pin.service';
export type { ChildCredentialService, ChildLoginAttempt, ChildLoginOutcome } from './pin.service';
export { argon2Hasher } from './secret-hasher';
export type { SecretHasher } from './secret-hasher';
export {
  CHILD_SESSION_COOKIE,
  clearChildCookie,
  readChildCookie,
  setChildCookie,
} from './child-session.cookie';
