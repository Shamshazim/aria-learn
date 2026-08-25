/**
 * The public surface of the identity layer.
 *
 * Everything below is internal: no service imports a vendor adapter, and no service imports
 * `jwt.ts`. The port and the primitives are all that cross this line (CODE-STANDARDS §4).
 */
export {
  identityEnvSchema,
  refineIdentityEnv,
  toIdentityConfig,
  SESSION_LIFETIMES,
  PICTURE_SECRET_THROTTLE,
} from './config';
export type { IdentityConfig, IdentityEnv, SupabaseSettings } from './config';

export { createIdentityProvider, IdentityConfigError } from './runtime';
export type { IdentityRuntimeDeps } from './runtime';

export type { AdultIdentityProvider, MagicLinkRequest, VerifiedAdultToken } from './provider/types';

export {
  randomSecrets,
  sequentialSecrets,
  hashSecret,
  secretMatches,
  isWellFormedSecret,
  SECRET_KINDS,
} from './secrets';
export type { SecretGenerator, SecretKind } from './secrets';

export { hashPictureSecret, pictureSecretMatches } from './picture-secret';
