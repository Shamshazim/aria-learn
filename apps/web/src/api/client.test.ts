import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';

const valueSchema = z.object({ value: z.string() });

afterEach(() => vi.useRealTimers());

describe('api client', () => {
  it('parses a successful envelope and sends a request id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { value: 'ready' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      createApiClient({ baseUrl: 'https://aria.test', fetcher }).get('/api/v1/test', valueSchema),
    ).resolves.toEqual({ value: 'ready' });
    const call = fetcher.mock.calls[0];
    if (call === undefined) throw new Error('Fetch was not called');
    expect(call[0]).toBe('https://aria.test/api/v1/test');
    expect(new Headers(call[1]?.headers).get('x-request-id')).not.toBeNull();
  });

  it('preserves the safe server code on a non-2xx response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } }), { status: 503 }),
      );

    await expect(
      createApiClient({ baseUrl: '', fetcher }).get('/api', valueSchema),
    ).rejects.toMatchObject({
      kind: 'http',
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
    });
  });

  it('sends a JSON body for a parsed POST response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { value: 'saved' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      createApiClient({ baseUrl: '', fetcher }).post('/api', { answer: 7 }, valueSchema),
    ).resolves.toEqual({ value: 'saved' });
    const call = fetcher.mock.calls[0];
    if (call === undefined) throw new Error('Fetch was not called');
    expect(call[1]).toMatchObject({ method: 'POST', body: '{"answer":7}' });
  });

  it('rejects malformed JSON and schema-invalid data as typed errors', async () => {
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json'));
    const invalid = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: { value: 42 } })));

    await expect(
      createApiClient({ baseUrl: '', fetcher: malformed }).get('/api', valueSchema),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      createApiClient({ baseUrl: '', fetcher: invalid }).get('/api', valueSchema),
    ).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('aborts and reports a timeout', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const result = createApiClient({ baseUrl: '', fetcher }).get('/api', valueSchema, {
      timeoutMs: 5,
    });
    const rejection = expect(result).rejects.toMatchObject({
      kind: 'timeout',
      code: 'REQUEST_TIMEOUT',
    });

    await vi.advanceTimersByTimeAsync(5);
    await rejection;
  });

  /**
   * The browser's `fetch` throws "Illegal invocation" when called as a method of some other
   * object. Streaming used to do exactly that, so every answer a child gave failed before the
   * request left the page — and the mocks here never noticed, because a `vi.fn` does not care
   * what `this` is. This one does.
   */
  it('calls fetch the way the browser requires, for a stream and for a request', async () => {
    const seen: unknown[] = [];
    const strictFetch = function (this: unknown): Promise<Response> {
      seen.push(this);
      if (this !== undefined && this !== globalThis) {
        return Promise.reject(new TypeError('Illegal invocation'));
      }
      return Promise.resolve(
        new Response('data: {"value":"ok"}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      );
    } as unknown as typeof fetch;
    const client = createApiClient({ baseUrl: '', fetcher: strictFetch });

    const frames: unknown[] = [];
    for await (const frame of client.postStream('/api', {}, valueSchema)) frames.push(frame);

    expect(frames).toEqual([{ value: 'ok' }]);
  });
});
