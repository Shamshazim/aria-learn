import { z } from 'zod';

/**
 * The database slice of configuration.
 *
 * It lives in its own module rather than in `env.ts` because the pool has its own vocabulary
 * — sizing, timeouts, a connection string — and the rest of the service should not have to
 * read past it. `env.ts` composes this schema into the one boot-time parse.
 */
const DEFAULTS = {
  poolMax: 10,
  idleTimeoutMs: 30_000,
  connectionTimeoutMs: 5_000,
  statementTimeoutMs: 10_000,
} as const;

/**
 * Only PostgreSQL. Accepting any URL here would move the failure from boot to the first
 * query, which is exactly the trade this service does not make.
 */
const POSTGRES_URL = /^postgres(ql)?:\/\/.+/;

export const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'is required')
    .regex(POSTGRES_URL, 'must be a postgres:// or postgresql:// connection string'),

  /** Per process. Postgres has a global connection ceiling, so this is sized, not maximised. */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(DEFAULTS.poolMax),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).max(600_000).default(DEFAULTS.idleTimeoutMs),
  DB_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .default(DEFAULTS.connectionTimeoutMs),
  /**
   * A server-side cap, so a pathological query is killed by Postgres rather than holding a
   * pooled connection open until the request times out (§8).
   */
  DB_STATEMENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(120_000)
    .default(DEFAULTS.statementTimeoutMs),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export type DatabaseConfig = {
  url: string;
  poolMax: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  statementTimeoutMs: number;
};

export function toDatabaseConfig(env: DatabaseEnv): DatabaseConfig {
  return {
    url: env.DATABASE_URL,
    poolMax: env.DB_POOL_MAX,
    idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.DB_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
  };
}
