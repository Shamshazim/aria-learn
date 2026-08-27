import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@/api';
import { createIdentityApi } from '@/features/auth/api/identity.api';

const SAM = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Sam',
  grade: '4',
  band: 'middle',
  avatar: 'fox',
  loginMethod: 'pin',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function build(fetcher: ReturnType<typeof vi.fn<typeof fetch>>) {
  return createIdentityApi(createApiClient({ baseUrl: '', fetcher }));
}

const callOf = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) => {
  const call = fetcher.mock.calls[index];
  if (call === undefined) throw new Error('fetch was not called');
  const target = call[0];
  if (typeof target !== 'string') throw new Error('the client should fetch by url string');
  return { url: target, init: call[1] ?? {} };
};

describe('talking to our own API about who is here', () => {
  /** The child session is a cookie, so every request has to be told to carry it. */
  it('sends credentials on every call', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ children: [SAM] }));

    await build(fetcher).children('parent-token');

    expect(callOf(fetcher).init.credentials).toBe('include');
  });

  it('carries the parent token on the routes that need one', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ children: [] }));

    await build(fetcher).children('parent-token');

    expect(new Headers(callOf(fetcher).init.headers).get('authorization')).toBe(
      'Bearer parent-token',
    );
  });

  /** Logout and refresh are the child's own, and must work when no adult is signed in. */
  it('sends no parent token on logout or refresh', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ signedOut: true }));

    await build(fetcher).logout();

    expect(new Headers(callOf(fetcher).init.headers).get('authorization')).toBeNull();
  });

  it('reads a refusal to refresh as "nobody is signed in here"', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }),
      );

    await expect(build(fetcher).refresh()).resolves.toBeNull();
  });

  it('parses a login into the session the screens are typed against', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        child: SAM,
        expiresAt: '2026-08-25T22:00:00.000Z',
        idleExpiresAt: '2026-08-25T10:30:00.000Z',
      }),
    );

    const session = await build(fetcher).login('parent-token', {
      childId: SAM.id,
      pin: '4321',
    });

    expect(session.child.firstName).toBe('Sam');
    expect(callOf(fetcher).init.body).toBe(JSON.stringify({ childId: SAM.id, pin: '4321' }));
  });

  it('grants voice consent for all three processors and says what the verification was', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'consent-1' }));

    await build(fetcher).grantVoiceConsent('parent-token', SAM.id);

    const { url, init } = callOf(fetcher);
    expect(url).toBe(`/api/v1/parent/children/${SAM.id}/consent/voice`);
    expect(init.body).toBe(
      JSON.stringify({
        processorCategories: ['media', 'stt', 'tts'],
        verificationReference: 'supabase-authenticated-parent',
      }),
    );
  });
});
