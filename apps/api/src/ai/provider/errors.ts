/**
 * `AiError` deliberately extends `Error`, not `AppError`: it never crosses the wire. It is the
 * adapter → routing signal (P0-13 retries, falls back or opens a breaker on `category`) and the
 * message is constant so a vendor body, key or prompt can never leak through it.
 */
export type AiErrorCategory =
  'transport' | 'rate_limit' | 'auth' | 'bad_request' | 'content' | 'timeout';

/** Safe provider failure that routing can act on without inspecting vendor details. */
export class AiError extends Error {
  readonly category: AiErrorCategory;
  readonly retryAfterMs: number | undefined;

  constructor(category: AiErrorCategory, retryAfterMs?: number) {
    super('AI provider request failed');
    this.name = 'AiError';
    this.category = category;
    this.retryAfterMs = retryAfterMs;
  }
}

/** All configured availability paths failed; its message is safe for higher layers to expose. */
export class AiExhaustionError extends ServiceUnavailableError {
  readonly category: AiErrorCategory;

  constructor(cause: AiError) {
    super('AI routes exhausted', cause);
    this.category = cause.category;
  }
}
import { ServiceUnavailableError } from '@/errors';
