import { z } from 'zod';

import { databaseEnvSchema, toDatabaseConfig } from './database';

import type { DatabaseConfig } from './database';

/**
 * Configuration is parsed once, at boot, and never read from `process.env` again.
 *
 * A missing variable has to stop the process before it serves anything. The alternative —
 * discovering it on the request that needs it — means a child meets the failure, which the
 * acceptance criteria for this ticket rule out explicitly.
 */
const DEFAULT_PORT = 3000;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  /** `silent` is a real pino level and the one tests use; it belongs in the contract. */
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Comma-separated. Empty means "same-origin only", which is the safe default. */
  CORS_ORIGINS: z.string().default(''),
  /** Bounds the JSON body so a large payload cannot become a denial of service (§8). */
  JSON_BODY_LIMIT: z.string().default('100kb'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(0).max(120_000).default(10_000),

  ...databaseEnvSchema.shape,
});

export type Env = z.infer<typeof envSchema>;

export type AppConfig = {
  env: Env['NODE_ENV'];
  port: number;
  logLevel: Env['LOG_LEVEL'];
  corsOrigins: readonly string[];
  jsonBodyLimit: string;
  shutdownTimeoutMs: number;
  version: string;
  isProduction: boolean;
  database: DatabaseConfig;
};

/**
 * Thrown only at boot. It names every offending variable, because an operator restarting a
 * container should not have to fix them one at a time.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(source: NodeJS.ProcessEnv, version: string): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid configuration — ${details}`);
  }

  const env = parsed.data;

  return {
    env: env.NODE_ENV,
    port: env.API_PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    jsonBodyLimit: env.JSON_BODY_LIMIT,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    version,
    isProduction: env.NODE_ENV === 'production',
    database: toDatabaseConfig(env),
  };
}
