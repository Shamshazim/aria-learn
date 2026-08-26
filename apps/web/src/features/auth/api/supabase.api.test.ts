import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api';
import { createSupabaseApi } from '@/features/auth/api/supabase.api';

const CONFIG = { url: 'https://project.supabase.co', anonKey: 'anon-key' };
const NOW = Date.parse('2026-08-25T10:00:00.000Z');

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3_600,
};

function build(fetcher: ReturnType<typeof vi.fn<typeof fetch>>) {
  return createSupabaseApi(CONFIG, { fetcher, now: () => NOW });
}

/** The url the first call went to, proven to be a url rather than assumed to be one. */
function urlOf(fetcher: ReturnType<typeof vi.fn<typeof fetch>>): string {
  const target = fetcher.mock.calls[0]?.[0];
  if (typeof target !== 'string') throw new Error('fetch was not called with a url');
  return target;
}

describe('signing a parent in', () => {
  it('posts the password grant with the project key and turns the reply into a deadline', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));

    await expect(build(fetcher).signIn('grown.up@example.test', 'hunter2')).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: NOW + 3_600_000,
    });
    expect(urlOf(fetcher)).toBe('https://project.supabase.co/auth/v1/token?grant_type=password');
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('apikey')).toBe('anon-key');
  });

  it('uses the refresh grant to renew one', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));

    await build(fetcher).refresh('refresh');

    expect(urlOf(fetcher)).toContain('grant_type=refresh_token');
  });

  /** One failure for every reason: a sign-in screen is not a way to enumerate accounts. */
  it('reports every refusal the same way', async () => {
    const refused = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"error":"invalid"}', { status: 400 }));

    await expect(build(refused).signIn('a@b.test', 'wrong')).rejects.toMatchObject({
      kind: 'http',
      code: 'SIGN_IN_FAILED',
    });
  });

  it('reports a network failure as one, not as a wrong password', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

    await expect(build(offline).signIn('a@b.test', 'hunter2')).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('refuses a reply that is not a session', async () => {
    const odd = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ access_token: 'only' }), { status: 200 }));

    await expect(build(odd).signIn('a@b.test', 'hunter2')).rejects.toBeInstanceOf(ApiError);
  });
});
