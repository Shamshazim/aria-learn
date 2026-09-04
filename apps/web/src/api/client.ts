import { z, type ZodType } from 'zod';

import { ApiError } from '@/api/errors';
import { readSse } from '@/api/sse';

const errorSchema = z.object({ error: z.object({ code: z.string() }) });
const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiClient = Readonly<{
  get<T>(path: string, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
  /** P2H-12: the parent app edits a child profile in place. */
  patch<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
  /**
   * P2H-07: the same POST, read as it arrives.
   *
   * There is no envelope and no timeout: a stream is open for as long as Aria is talking, and
   * the frames are the response. A caller that wants one settled answer uses `post`.
   */
  postStream<T>(
    path: string,
    body: unknown,
    schema: ZodType<T>,
    options?: RequestOptions,
  ): AsyncIterable<T>;
}>;

type RequestOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * X-05: the key that makes this call safe for the API to receive twice.
   *
   * Supplied by the caller, not generated here, because the whole value is in it being the
   * *same* key on a retry — a fresh one per attempt would make every retry a new request and
   * buy nothing. A caller that retries holds its key for as long as it retries.
   */
  idempotencyKey?: string;
  /**
   * P2H-12: the parent's bearer token, on the routes that need one. The child's session is a
   * cookie and never passes through here — no script should be able to read or set it.
   */
  headers?: Readonly<Record<string, string>>;
}>;

export function createApiClient(dependencies: {
  baseUrl: string;
  fetcher?: typeof globalThis.fetch;
}): ApiClient {
  // Native `fetch` must be called with `this` unbound or as the window: a reference stored on
  // an object and invoked as a method throws "Illegal invocation" in the browser.
  const fetcher = dependencies.fetcher ?? globalThis.fetch.bind(globalThis);
  return {
    get: (path, schema, options) =>
      request({
        fetcher,
        baseUrl: dependencies.baseUrl,
        path,
        schema,
        method: 'GET',
        ...(options === undefined ? {} : { options }),
      }),
    postStream: (path, body, schema, options) =>
      streamRequest({
        fetcher,
        baseUrl: dependencies.baseUrl,
        path,
        body,
        schema,
        ...(options === undefined ? {} : { options }),
      }),
    post: (path, body, schema, options) =>
      request({
        fetcher,
        baseUrl: dependencies.baseUrl,
        path,
        schema,
        method: 'POST',
        body,
        ...(options === undefined ? {} : { options }),
      }),
    patch: (path, body, schema, options) =>
      request({
        fetcher,
        baseUrl: dependencies.baseUrl,
        path,
        schema,
        method: 'PATCH',
        body,
        ...(options === undefined ? {} : { options }),
      }),
  };
}

async function request<T>(input: {
  fetcher: typeof globalThis.fetch;
  baseUrl: string;
  path: string;
  schema: ZodType<T>;
  method: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  options?: RequestOptions;
}): Promise<T> {
  const options = input.options ?? {};
  const timeout = createTimeout(options);
  try {
    const fetcher = input.fetcher;
    const response = await fetcher(`${input.baseUrl}${input.path}`, {
      method: input.method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-request-id': crypto.randomUUID(),
        ...idempotencyHeader(input.method, options),
        ...options.headers,
      },
      // P2H-12: the child session is an http-only cookie, so every call has to carry it.
      credentials: 'include',
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal: timeout.signal,
    });
    const body = await parseJson(response);
    if (!response.ok) throw httpError(response.status, body);
    const envelope = z.object({ data: input.schema }).safeParse(body);
    if (!envelope.success) throw new ApiError('malformed', 'MALFORMED_RESPONSE');
    return envelope.data.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timeout.expired()) throw new ApiError('timeout', 'REQUEST_TIMEOUT');
    if (options.signal?.aborted === true) throw new ApiError('aborted', 'REQUEST_ABORTED');
    throw new ApiError('network', 'NETWORK_ERROR');
  } finally {
    timeout.dispose();
  }
}

async function* streamRequest<T>(input: {
  fetcher: typeof globalThis.fetch;
  baseUrl: string;
  path: string;
  body: unknown;
  schema: ZodType<T>;
  options?: RequestOptions;
}): AsyncIterable<T> {
  const response = await openStream({
    fetcher: input.fetcher,
    baseUrl: input.baseUrl,
    path: input.path,
    body: input.body,
    ...(input.options === undefined ? {} : { options: input.options }),
  });
  for await (const frame of readSse(response)) {
    const parsed = input.schema.safeParse(frame);
    if (!parsed.success) throw new ApiError('malformed', 'MALFORMED_RESPONSE');
    yield parsed.data;
  }
}

async function openStream(input: {
  fetcher: typeof globalThis.fetch;
  baseUrl: string;
  path: string;
  body: unknown;
  options?: RequestOptions;
}): Promise<ReadableStream<Uint8Array>> {
  let response: Response;
  const fetcher = input.fetcher;
  try {
    response = await fetcher(`${input.baseUrl}${input.path}`, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        'x-request-id': crypto.randomUUID(),
        ...input.options?.headers,
      },
      body: JSON.stringify(input.body),
      credentials: 'include',
      ...(input.options?.signal === undefined ? {} : { signal: input.options.signal }),
    });
  } catch {
    throw new ApiError('network', 'NETWORK_ERROR');
  }
  if (!response.ok) throw httpError(response.status, await parseJson(response));
  if (response.body === null) throw new ApiError('malformed', 'MALFORMED_RESPONSE');
  return response.body;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError('malformed', 'MALFORMED_JSON', response.status);
  }
}

/**
 * `Idempotency-Key`, on the methods that change something (X-05).
 *
 * A `GET` never carries one: it changes nothing, so replaying it is already safe and a key
 * would only fill the server's table. Where a caller supplies no key we generate one per
 * attempt, which still protects the server from a *network-level* duplicate — the same request
 * arriving twice because a proxy resent it — while a caller that wants its own retries
 * de-duplicated passes `idempotencyKey` and keeps it across them.
 */
function idempotencyHeader(
  method: 'GET' | 'POST' | 'PATCH',
  options: RequestOptions,
): Record<string, string> {
  if (method === 'GET') return {};
  return { 'idempotency-key': options.idempotencyKey ?? crypto.randomUUID() };
}

function httpError(status: number, body: unknown): ApiError {
  const parsed = errorSchema.safeParse(body);
  return new ApiError('http', parsed.success ? parsed.data.error.code : 'HTTP_ERROR', status);
}

function createTimeout(options: RequestOptions): Readonly<{
  signal: AbortSignal;
  expired(): boolean;
  dispose(): void;
}> {
  const controller = new AbortController();
  let didExpire = false;
  const abort = (): void => {
    controller.abort();
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(() => {
    didExpire = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return {
    signal: controller.signal,
    expired: () => didExpire,
    dispose: () => {
      window.clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    },
  };
}
