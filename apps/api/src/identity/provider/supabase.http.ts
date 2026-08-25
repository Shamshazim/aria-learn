import { ServiceUnavailableError, UnauthenticatedError } from '@/errors';

/**
 * The only place in the process that speaks to the identity vendor over the network.
 *
 * It exists so the adapter reads as four API calls rather than as four copies of the same
 * header assembly and error mapping. Two rules it carries for all of them: a request body
 * never reaches a log, and a vendor status code never reaches a client — a 4xx from the
 * vendor is "Aria will not honour this credential", a 5xx is "try again later", and neither
 * message names the vendor (CODE-STANDARDS §5).
 */
export type Fetcher = typeof globalThis.fetch;

export type SupabaseHttpConfig = Readonly<{
  baseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  fetch: Fetcher;
  timeoutMs: number;
}>;

export type SupabaseCall = Readonly<{
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  /** Parsed and sent as JSON. Only ever adult-side fields — see `AdultIdentityProvider`. */
  body?: Readonly<Record<string, string>>;
  /** The caller's own access token, for the per-user surface. */
  bearer?: string;
  /** Use the service-role key. Only the deletion orchestrator does. */
  admin?: boolean;
}>;

export type SupabaseHttp = Readonly<{
  /** Resolves to the parsed body, or `null` for 204 and for a 404 the caller treats as absent. */
  call(request: SupabaseCall): Promise<unknown>;
}>;

export function createSupabaseHttp(config: SupabaseHttpConfig): SupabaseHttp {
  return {
    async call(request) {
      const response = await send(config, request);

      if (response.status === 401 || response.status === 403) {
        throw new UnauthenticatedError(
          `identity provider rejected the credential (${request.path})`,
        );
      }
      // A 404 on the admin surface is "already gone", which the deletion orchestrator needs to
      // read as success. Returning null rather than throwing keeps that decision in the adapter.
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new ServiceUnavailableError(
          `identity provider returned ${String(response.status)} (${request.path})`,
        );
      }

      return response.status === 204 ? null : await parseJson(response, request.path);
    },
  };
}

async function send(config: SupabaseHttpConfig, request: SupabaseCall): Promise<Response> {
  // A hung vendor must not hold a request open: without this, a slow provider becomes a slow
  // Aria, and the child waiting on the other side of it sees neither.
  const abort = AbortSignal.timeout(config.timeoutMs);

  try {
    return await config.fetch(new URL(request.path, config.baseUrl), {
      method: request.method,
      headers: headersFor(config, request),
      signal: abort,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
  } catch (error) {
    // The cause carries the reason for the log. The client is told only that a dependency is
    // down, and is never told which one.
    throw new ServiceUnavailableError(`identity provider is unreachable (${request.path})`, error);
  }
}

function headersFor(config: SupabaseHttpConfig, request: SupabaseCall): Record<string, string> {
  const key = request.admin === true ? config.serviceRoleKey : config.anonKey;

  return {
    apikey: key,
    authorization: `Bearer ${request.bearer ?? key}`,
    ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
  };
}

async function parseJson(response: Response, path: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new ServiceUnavailableError(
      `identity provider returned a body that is not JSON (${path})`,
      error,
    );
  }
}
