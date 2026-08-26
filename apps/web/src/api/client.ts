import { z, type ZodType } from 'zod';

import { ApiError } from '@/api/errors';

const errorSchema = z.object({ error: z.object({ code: z.string() }) });
const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiClient = Readonly<{
  get<T>(path: string, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
  del<T>(path: string, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
}>;

/**
 * `headers` carries the credential for a request that needs one — the device secret, the
 * child's session token, an adult's bearer token (P0-28). Per request rather than per client,
 * because a device holds more than one and the page decides which applies.
 */
export type RequestOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Readonly<Record<string, string>>;
}>;

export function createApiClient(dependencies: {
  baseUrl: string;
  fetcher?: typeof globalThis.fetch;
}): ApiClient {
  const fetcher = dependencies.fetcher ?? globalThis.fetch;
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
    del: (path, schema, options) =>
      request({
        fetcher,
        baseUrl: dependencies.baseUrl,
        path,
        schema,
        method: 'DELETE',
        ...(options === undefined ? {} : { options }),
      }),
  };
}

async function request<T>(input: {
  fetcher: typeof globalThis.fetch;
  baseUrl: string;
  path: string;
  schema: ZodType<T>;
  method: 'GET' | 'POST' | 'DELETE';
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
        ...options.headers,
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal: timeout.signal,
    });
    // 204 has no body to parse, and a schema that accepts `null` is what a caller uses for it.
    const body = response.status === 204 ? { data: null } : await parseJson(response);
    if (!response.ok) throw httpError(response, body);
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

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError('malformed', 'MALFORMED_JSON', response.status);
  }
}

function httpError(response: Response, body: unknown): ApiError {
  const parsed = errorSchema.safeParse(body);
  const code = parsed.success ? parsed.data.error.code : 'HTTP_ERROR';
  const retryAfter = Number(response.headers.get('retry-after'));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? new ApiError('http', code, response.status, retryAfter)
    : new ApiError('http', code, response.status);
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
