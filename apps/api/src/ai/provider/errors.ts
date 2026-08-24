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
