import { z } from 'zod';

import { ApiError } from '@/api';
import type { WebConfig } from '@/app/config';

/**
 * Signing a parent in, against Supabase's own auth endpoint (P2H-12).
 *
 * Deliberately not the Supabase SDK. The SDK's job is session management — it decides where a
 * token is kept, when it is refreshed and what else is stored beside it — and those are the
 * decisions this ticket exists to make on purpose. Two typed calls are the whole of what we
 * need from it, so we make those two calls.
 */
const sessionSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
});

export type ParentTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. The client refreshes before this; the API checks it again anyway. */
  expiresAt: number;
}>;

export type SupabaseApi = Readonly<{
  signIn(email: string, password: string): Promise<ParentTokens>;
  refresh(refreshToken: string): Promise<ParentTokens>;
}>;

export function createSupabaseApi(
  config: NonNullable<WebConfig['supabase']>,
  deps: Readonly<{ fetcher?: typeof globalThis.fetch; now?: () => number }> = {},
): SupabaseApi {
  const fetcher = deps.fetcher ?? globalThis.fetch;
  const now = deps.now ?? (() => Date.now());
  const call = async (grant: string, body: unknown): Promise<ParentTokens> => {
    const response = await post(fetcher, config, grant, body);
    const parsed = sessionSchema.safeParse(response);
    if (!parsed.success) throw new ApiError('malformed', 'MALFORMED_RESPONSE');
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: now() + parsed.data.expires_in * 1_000,
    };
  };
  return {
    signIn: (email, password) => call('password', { email, password }),
    refresh: (refreshToken) => call('refresh_token', { refresh_token: refreshToken }),
  };
}

async function post(
  fetcher: typeof globalThis.fetch,
  config: NonNullable<WebConfig['supabase']>,
  grant: string,
  body: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`${config.url}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 'NETWORK_ERROR');
  }
  // The reason is Supabase's to know. A sign-in screen says "that did not work", because
  // "no such account" is a fact about a family that a stranger at the keyboard may not have.
  if (!response.ok) throw new ApiError('http', 'SIGN_IN_FAILED', response.status);
  try {
    return await response.json();
  } catch {
    throw new ApiError('malformed', 'MALFORMED_JSON', response.status);
  }
}
