import { AiError } from '@/ai/provider/errors';

const MAX_RETRY_AFTER_MS = 5 * 60 * 1_000;

/** Maps provider HTTP failures without retaining vendor response bodies. */
export function createProviderHttpError(response: Response, nowMs: number): AiError {
  if (response.status === 429) {
    return new AiError('rate_limit', parseRetryAfter(response.headers.get('retry-after'), nowMs));
  }
  if (response.status === 401 || response.status === 403) return new AiError('auth');
  if (response.status >= 400 && response.status < 500) return new AiError('bad_request');
  return new AiError('transport');
}

function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, seconds * 1_000);
  }
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs)
    ? Math.min(MAX_RETRY_AFTER_MS, Math.max(0, dateMs - nowMs))
    : undefined;
}
