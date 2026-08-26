import { z } from 'zod';

import type { Band } from '@aria/shared';

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

const envObjectSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  /** `silent` is a real pino level and the one tests use; it belongs in the contract. */
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Comma-separated. Empty means "same-origin only", which is the safe default. */
  CORS_ORIGINS: z.string().default(''),
  /** Bounds the JSON body so a large payload cannot become a denial of service (§8). */
  JSON_BODY_LIMIT: z.string().default('100kb'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(0).max(120_000).default(10_000),
  AI_DAILY_SPEND_CAP_USD: z.coerce.number().positive().max(100).default(1),
  STATUS_OPERATOR_TOKEN: z.string().min(32).max(512).optional(),
  SESSION_LIMIT_EARLY_MINUTES: z.coerce.number().int().min(8).max(12).default(12),
  SESSION_LIMIT_MIDDLE_MINUTES: z.coerce.number().int().min(15).max(20).default(20),
  SESSION_LIMIT_SENIOR_MINUTES: z.coerce.number().int().min(20).max(30).default(30),
  MEMORY_REPETITIONS_FOR_DURABLE_FACT: z.coerce.number().int().min(1).max(10).default(1),
  ARIA_DEMO_STUDENT_ID: z.uuid().optional(),
  SAFEGUARDING_WEBHOOK_URL: z.url().optional(),
  SAFEGUARDING_WEBHOOK_TOKEN: z.string().min(32).max(512).optional(),
  LIVEKIT_URL: z.url().optional(),
  LIVEKIT_API_KEY: z.string().min(1).max(256).optional(),
  LIVEKIT_API_SECRET: z.string().min(16).max(512).optional(),
  VOICE_WORKER_TOKEN: z.string().min(32).max(512).optional(),
  VOICE_REGION: z.string().min(2).max(32).default('us-west'),
  VOICE_PRIVACY_SIGNOFF_ID: z.string().min(3).max(128).optional(),
  VOICE_STT_MODEL: z.string().min(1).max(128).default('assemblyai/universal-3-5-pro'),
  VOICE_TTS_MODEL: z.string().min(1).max(128).default('fishaudio/s2.1-pro'),
  // P2H-08: a named voice per band. The API only describes them to the consent record; the
  // worker is what fails to boot without them.
  VOICE_TTS_VOICE_EARLY: z.string().min(1).max(128).optional(),
  VOICE_TTS_VOICE_MIDDLE: z.string().min(1).max(128).optional(),
  VOICE_TTS_VOICE_SENIOR: z.string().min(1).max(128).optional(),

  ...databaseEnvSchema.shape,
});

export const envSchema = envObjectSchema.superRefine(validateEnvironment);

/**
 * Just the per-band voice ids, parsed on their own (P2H-09).
 *
 * `synth-bridges.ts --dry-run` needs to know which voices a library would be recorded for and
 * nothing else; making it satisfy the whole environment — a database URL above all — to print a
 * list of sentences is what would push a reviewer into reading `process.env` by hand instead.
 */
export const voiceIdEnvSchema = envObjectSchema.pick({
  VOICE_TTS_VOICE_EARLY: true,
  VOICE_TTS_VOICE_MIDDLE: true,
  VOICE_TTS_VOICE_SENIOR: true,
});

export function readVoiceIds(
  source: NodeJS.ProcessEnv,
): Readonly<Record<Band, string | undefined>> {
  const env = voiceIdEnvSchema.parse(source);
  return {
    early: env.VOICE_TTS_VOICE_EARLY,
    middle: env.VOICE_TTS_VOICE_MIDDLE,
    senior: env.VOICE_TTS_VOICE_SENIOR,
  };
}

type ParsedEnvironment = z.infer<typeof envObjectSchema>;

function validateEnvironment(env: ParsedEnvironment, context: z.RefinementCtx): void {
  validateProductionEnvironment(env, context);
  validateVoiceEnvironment(env, context);
}

function validateProductionEnvironment(env: ParsedEnvironment, context: z.RefinementCtx): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.STATUS_OPERATOR_TOKEN === undefined)
    addIssue(context, 'STATUS_OPERATOR_TOKEN', 'is required in production');
  if (env.ARIA_DEMO_STUDENT_ID !== undefined)
    addIssue(context, 'ARIA_DEMO_STUDENT_ID', 'is forbidden in production');
  if (env.SAFEGUARDING_WEBHOOK_URL === undefined || env.SAFEGUARDING_WEBHOOK_TOKEN === undefined) {
    addIssue(
      context,
      'SAFEGUARDING_WEBHOOK_URL',
      'and SAFEGUARDING_WEBHOOK_TOKEN are required in production',
    );
  }
}

function validateVoiceEnvironment(env: ParsedEnvironment, context: z.RefinementCtx): void {
  const values = [
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    env.VOICE_WORKER_TOKEN,
  ];
  const configured = values.filter((value) => value !== undefined).length;
  if (configured > 0 && configured < values.length)
    addIssue(
      context,
      'LIVEKIT_URL',
      'all LiveKit and voice worker settings must be supplied together',
    );
  if (configured > 0 && env.STATUS_OPERATOR_TOKEN === undefined)
    addIssue(context, 'STATUS_OPERATOR_TOKEN', 'is required to administer voice consent');
  if (env.NODE_ENV === 'production' && configured > 0 && env.VOICE_PRIVACY_SIGNOFF_ID === undefined)
    addIssue(
      context,
      'VOICE_PRIVACY_SIGNOFF_ID',
      'is required before production voice can be enabled',
    );
}

function addIssue(context: z.RefinementCtx, path: string, message: string): void {
  context.addIssue({ code: 'custom', path: [path], message });
}

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
  aiDailySpendCapUsd: number;
  statusOperatorToken: string | undefined;
  sessionLimitMinutes: Readonly<Record<'early' | 'middle' | 'senior', number>>;
  memoryRepetitionsForDurableFact: number;
  demoStudentId: string | undefined;
  safeguardingWebhookUrl: string | undefined;
  safeguardingWebhookToken: string | undefined;
  voice:
    | Readonly<{
        livekitUrl: string;
        apiKey: string;
        apiSecret: string;
        workerToken: string;
        region: string;
        privacySignoffId: string | undefined;
        sttModel: string;
        ttsModel: string;
        ttsVoices: Readonly<Record<Band, string | undefined>>;
      }>
    | undefined;
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
    aiDailySpendCapUsd: env.AI_DAILY_SPEND_CAP_USD,
    statusOperatorToken: env.STATUS_OPERATOR_TOKEN,
    sessionLimitMinutes: {
      early: env.SESSION_LIMIT_EARLY_MINUTES,
      middle: env.SESSION_LIMIT_MIDDLE_MINUTES,
      senior: env.SESSION_LIMIT_SENIOR_MINUTES,
    },
    memoryRepetitionsForDurableFact: env.MEMORY_REPETITIONS_FOR_DURABLE_FACT,
    demoStudentId: env.ARIA_DEMO_STUDENT_ID,
    safeguardingWebhookUrl: env.SAFEGUARDING_WEBHOOK_URL,
    safeguardingWebhookToken: env.SAFEGUARDING_WEBHOOK_TOKEN,
    voice:
      env.LIVEKIT_URL === undefined ||
      env.LIVEKIT_API_KEY === undefined ||
      env.LIVEKIT_API_SECRET === undefined ||
      env.VOICE_WORKER_TOKEN === undefined
        ? undefined
        : {
            livekitUrl: env.LIVEKIT_URL,
            apiKey: env.LIVEKIT_API_KEY,
            apiSecret: env.LIVEKIT_API_SECRET,
            workerToken: env.VOICE_WORKER_TOKEN,
            region: env.VOICE_REGION,
            privacySignoffId: env.VOICE_PRIVACY_SIGNOFF_ID,
            sttModel: env.VOICE_STT_MODEL,
            ttsModel: env.VOICE_TTS_MODEL,
            ttsVoices: {
              early: env.VOICE_TTS_VOICE_EARLY,
              middle: env.VOICE_TTS_VOICE_MIDDLE,
              senior: env.VOICE_TTS_VOICE_SENIOR,
            },
          },
    database: toDatabaseConfig(env),
  };
}
