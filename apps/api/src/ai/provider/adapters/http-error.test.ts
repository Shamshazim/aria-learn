import { describe, expect, it } from 'vitest';

import { createProviderHttpError } from '@/ai/provider/adapters/http-error';

describe('provider HTTP errors', () => {
  it('bounds Retry-After from an untrusted provider', () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'retry-after': '999999999999999999999' },
    });

    expect(createProviderHttpError(response, 0)).toMatchObject({
      category: 'rate_limit',
      retryAfterMs: 300_000,
    });
  });

  it('ignores an empty Retry-After header', () => {
    const response = new Response(null, { status: 429, headers: { 'retry-after': '' } });

    expect(createProviderHttpError(response, 0).retryAfterMs).toBeUndefined();
  });
});
