import { z, type ZodType } from 'zod';

import { ApiError } from '@/api/errors';

const errorSchema = z.object({ error: z.object({ code: z.string() }) });
const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiClient = Readonly<{
  get<T>(path: string, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>;
}>;

type RequestOptions = Readonly<{ signal?: AbortSignal; timeoutMs?: number }>;

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
  };
}

async function request<T>(input: {
  fetcher: typeof globalThis.fetch;
  baseUrl: string;
  path: string;
  schema: ZodType<T>;
  method: 'GET' | 'POST';
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
      },
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

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError('malformed', 'MALFORMED_JSON', response.status);
  }
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
