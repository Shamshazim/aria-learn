import { z } from 'zod';

/**
 * The identity slice of configuration (P2H-12).
 *
 * Its own module for the same reason the database has one: signing in has a vocabulary of its
 * own — a Supabase project, a cookie secret, a demo escape hatch — and `env.ts` should compose
 * it rather than grow it. The demo student lives here too, because whether it is honoured is
 * an identity decision and not a general one.
 */

/**
 * `z.coerce.boolean()` reads the string "false" as true, which is exactly the mistake a flag
 * guarding the demo student must not make. Only the word "true" turns one on.
 */
const booleanEnv = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .or(z.boolean());

export const authEnvSchema = z.object({
  ARIA_DEMO_STUDENT_ID: z.uuid().optional(),
  /**
   * The demo student is a development convenience and has to be asked for twice. `NODE_ENV`
   * alone was not enough — a container started with the wrong env file was one variable away
   * from serving every child as the same demo row.
   */
  ALLOW_DEMO_STUDENT: booleanEnv.default(false),
  /** The Supabase project parents authenticate against. Required in production. */
  SUPABASE_URL: z.url().optional(),
  /** The `aud` claim Supabase mints for a signed-in user. Configurable, rarely changed. */
  SUPABASE_JWT_AUDIENCE: z.string().min(1).max(128).default('authenticated'),
  /** Signs the child session cookie, so a tampered one is refused without a query. */
  CHILD_SESSION_SECRET: z.string().min(32).max(512).optional(),
  /**
   * Deletes a parent's provider user when they delete their account (P0-28). Optional, and
   * its absence is not silent: erasure records what it still owes rather than pretending.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).max(1024).optional(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

export type AuthConfig = Readonly<{
  supabaseUrl: string;
  jwksUrl: string;
  issuer: string;
  audience: string;
  childSessionSecret: string;
  /** Undefined where account deletion cannot reach the provider. See `provider-directory`. */
  serviceRoleKey: string | undefined;
}>;

/**
 * Both URLs are derived from the project URL rather than configured separately: Supabase
 * publishes them at fixed paths, and two variables that must agree are two variables that
 * eventually will not.
 */
export function toAuthConfig(env: AuthEnv): AuthConfig | undefined {
  if (env.SUPABASE_URL === undefined || env.CHILD_SESSION_SECRET === undefined) return undefined;
  const base = env.SUPABASE_URL.replace(/\/+$/u, '');
  return {
    supabaseUrl: base,
    jwksUrl: `${base}/auth/v1/.well-known/jwks.json`,
    issuer: `${base}/auth/v1`,
    audience: env.SUPABASE_JWT_AUDIENCE,
    childSessionSecret: env.CHILD_SESSION_SECRET,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** The demo student, only where both switches say so. Production refuses it at boot. */
export function toDemoStudentId(env: AuthEnv): string | undefined {
  return env.ALLOW_DEMO_STUDENT ? env.ARIA_DEMO_STUDENT_ID : undefined;
}
