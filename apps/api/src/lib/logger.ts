import { pino, type Logger } from 'pino';

/**
 * Structured JSON logging with a redaction list that is not optional.
 *
 * The list exists because of what this product logs near: a child's name, a parent's email
 * and a prompt are all one careless `log.info(req.body)` away from a log aggregator. Redact
 * at the logger, so no call site has to remember (CODE-STANDARDS §5).
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers["api-key"]',
  'req.headers["x-api-key"]',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.prompt',
  '*.name',
  '*.email',
  'password',
  'token',
  'prompt',
  'name',
  'email',
] as const;

export type { Logger };

export type LoggerOptions = {
  level: string;
};

/**
 * Always structured JSON, in every environment (CODE-STANDARDS §5). No pretty-printing
 * transport: it would be a second code path that only runs in development, and the one place
 * a logger must not be surprising is at boot.
 */
export function createLogger({ level }: LoggerOptions): Logger {
  return pino({
    level,
    redact: { paths: [...REDACTED_PATHS], censor: '[redacted]' },
  });
}
