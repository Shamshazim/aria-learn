import { z } from 'zod';

/**
 * Identity configuration, validated at boot like every other vendor surface (§4).
 *
 * The provider is a choice, not a hard-coded import: `fake` is what lets a developer run the
 * whole product without a Supabase project, and the refinement below is what stops that
 * convenience from ever reaching production. Supabase's keys are required only when Supabase
 * is the chosen provider, so a `fake` developer is not asked for credentials they do not have.
 */
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * The lifetimes P0-26 fixed. They are constants rather than environment variables on purpose:
 * a compliance decision that an operator can quietly widen is not a decision.
 */
export const SESSION_LIFETIMES = {
  adultIdleMs: 7 * DAY_MS,
  adultAbsoluteMs: 30 * DAY_MS,
  childIdleMs: 30 * MINUTE_MS,
  childAbsoluteMs: 4 * HOUR_MS,
  /** How recently the provider must have been re-checked for a sensitive parent action. */
  freshVerificationMs: 5 * MINUTE_MS,
} as const;

/** How hard a child's four-picture secret is to guess online, before the profile locks. */
export const PICTURE_SECRET_THROTTLE = {
  maxAttempts: 5,
  lockoutMs: 15 * MINUTE_MS,
} as const;

/**
 * The field definitions only. `AppConfig`'s schema spreads `.shape` into its own object, which
 * carries fields but not refinements — so the cross-field rule below is exported as a function
 * and called from there, rather than attached here where it would be silently dropped.
 */
export const identityEnvSchema = z.object({
  IDENTITY_PROVIDER: z.enum(['supabase', 'fake']).default('fake'),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_ANON_KEY: z.string().min(20).max(4096).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).max(4096).optional(),
  /** The HS256 signing secret. Verification is local, so this never leaves the process. */
  SUPABASE_JWT_SECRET: z.string().min(32).max(4096).optional(),
  SUPABASE_JWT_ISSUER: z.string().min(1).max(512).optional(),
  SUPABASE_JWT_AUDIENCE: z.string().min(1).max(512).default('authenticated'),
  SUPABASE_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  /** Where the provider returns an adult after they follow the link. */
  IDENTITY_MAGIC_LINK_REDIRECT: z.url().optional(),
});

export type IdentityEnv = z.infer<typeof identityEnvSchema>;

const SUPABASE_REQUIRED_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
] as const;

/**
 * Every Supabase key is required once Supabase is the chosen provider, and none of them is
 * required otherwise — so a developer on the in-process provider is never asked for
 * credentials they do not have.
 */
export function refineIdentityEnv(env: IdentityEnv, context: z.RefinementCtx): void {
  if (env.IDENTITY_PROVIDER !== 'supabase') return;

  for (const key of SUPABASE_REQUIRED_KEYS) {
    if (env[key] === undefined) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: 'is required for IDENTITY_PROVIDER=supabase',
      });
    }
  }
}

export type SupabaseSettings = Readonly<{
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
  jwtIssuer: string | undefined;
  jwtAudience: string;
  timeoutMs: number;
}>;

export type IdentityConfig = Readonly<{
  provider: IdentityEnv['IDENTITY_PROVIDER'];
  magicLinkRedirect: string | undefined;
  /** Present exactly when `provider` is `'supabase'`; the refinement above guarantees it. */
  supabase: SupabaseSettings | undefined;
}>;

export function toIdentityConfig(env: IdentityEnv): IdentityConfig {
  return {
    provider: env.IDENTITY_PROVIDER,
    magicLinkRedirect: env.IDENTITY_MAGIC_LINK_REDIRECT,
    supabase: toSupabaseSettings(env),
  };
}

function toSupabaseSettings(env: IdentityEnv): SupabaseSettings | undefined {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET } = env;

  if (
    SUPABASE_URL === undefined ||
    SUPABASE_ANON_KEY === undefined ||
    SUPABASE_SERVICE_ROLE_KEY === undefined ||
    SUPABASE_JWT_SECRET === undefined
  ) {
    return undefined;
  }

  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: SUPABASE_JWT_SECRET,
    jwtIssuer: env.SUPABASE_JWT_ISSUER,
    jwtAudience: env.SUPABASE_JWT_AUDIENCE,
    timeoutMs: env.SUPABASE_TIMEOUT_MS,
  };
}
