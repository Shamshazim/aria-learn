import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PictureSecret, SecretPictureKey } from '@aria/shared';

import { ApiError } from '@/api';

import { createMemoryCredentialStore } from '../model/credential-store';

import { useChildSignIn } from './useChildSignIn';

import type { ChildAuthApi, ChildProfile, ChildSession } from '../api/child-auth.api';

const PROFILES: readonly ChildProfile[] = [
  { studentId: 'child-1', nickname: 'Ada', avatarKey: 'fox' },
  { studentId: 'child-2', nickname: 'Sam', avatarKey: 'owl' },
];

const SECRET: readonly SecretPictureKey[] = ['apple', 'star', 'boat', 'drum'];

const SESSION: ChildSession = {
  sessionId: 'session-1',
  studentId: 'child-1',
  token: 'child-session-token',
  expiresAt: '2026-01-01T00:00:00.000Z',
};

type OpenResult = ChildSession | Error;

function fakeApi(
  overrides: Partial<{ profiles: readonly ChildProfile[] | Error; open: OpenResult }> = {},
): ChildAuthApi & { opened: { studentId: string; pictureSecret: PictureSecret }[] } {
  const opened: { studentId: string; pictureSecret: PictureSecret }[] = [];
  return {
    opened,
    profiles: (_deviceSecret) => {
      const result = overrides.profiles ?? PROFILES;
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
    open: (input) => {
      opened.push({ studentId: input.studentId, pictureSecret: input.pictureSecret });
      const result = overrides.open ?? SESSION;
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
    end: () => Promise.resolve(null),
  };
}

function storeWithDevice(secret: string | null = 'device-secret') {
  const store = createMemoryCredentialStore();
  if (secret !== null) store.rememberDevice(secret);
  return store;
}

/** Taps the four pictures one at a time, as a child does. */
async function tapSecret(tap: (picture: SecretPictureKey) => void): Promise<void> {
  for (const picture of SECRET) {
    await act(async () => {
      tap(picture);
      await Promise.resolve();
    });
  }
}

describe('useChildSignIn', () => {
  it('asks for a grown-up when the device has no grant, without calling the API', async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useChildSignIn({ api, store: storeWithDevice(null) }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('needs_device');
    });
    expect(api.opened).toHaveLength(0);
  });

  it('loads the profiles this device may open', async () => {
    const { result } = renderHook(() =>
      useChildSignIn({ api: fakeApi(), store: storeWithDevice() }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('choosing');
    });
  });

  it('forgets a grant the server no longer honours', async () => {
    const store = storeWithDevice();
    const api = fakeApi({ profiles: new ApiError('http', 'UNAUTHENTICATED', 401) });
    const { result } = renderHook(() => useChildSignIn({ api, store }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('needs_device');
    });
    expect(store.deviceSecret()).toBeNull();
  });

  it('opens a session on the fourth tap and remembers the token', async () => {
    const store = storeWithDevice();
    const api = fakeApi();
    const signedIn: ChildSession[] = [];
    const { result } = renderHook(() =>
      useChildSignIn({
        api,
        store,
        onSignedIn: (session) => {
          signedIn.push(session);
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('choosing');
    });
    act(() => {
      result.current.choose('child-1');
    });
    await tapSecret(result.current.tap);

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(api.opened).toEqual([{ studentId: 'child-1', pictureSecret: SECRET }]);
    expect(store.sessionToken()).toBe(SESSION.token);
    expect(signedIn).toHaveLength(1);
  });

  it('clears the pad and stays on the profile when the secret is wrong', async () => {
    const api = fakeApi({ open: new ApiError('http', 'UNAUTHENTICATED', 401) });
    const store = storeWithDevice();
    const { result } = renderHook(() => useChildSignIn({ api, store }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('choosing');
    });
    act(() => {
      result.current.choose('child-1');
    });
    await tapSecret(result.current.tap);

    await waitFor(() => {
      expect(result.current.state).toMatchObject({ status: 'secret', taps: [], retry: true });
    });
    expect(store.sessionToken()).toBeNull();
  });

  it('counts down the server-supplied wait after too many tries', async () => {
    const api = fakeApi({ open: new ApiError('http', 'TOO_MANY_ATTEMPTS', 429, 900) });
    const { result } = renderHook(() => useChildSignIn({ api, store: storeWithDevice() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('choosing');
    });
    act(() => {
      result.current.choose('child-2');
    });
    await tapSecret(result.current.tap);

    await waitFor(() => {
      expect(result.current.state).toMatchObject({ status: 'locked', seconds: 900 });
    });
  });

  it('reloads the profiles once a grown-up enters a setup code', async () => {
    const store = storeWithDevice(null);
    const api = fakeApi();
    const { result } = renderHook(() => useChildSignIn({ api, store }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('needs_device');
    });
    act(() => {
      result.current.linkDevice('  device-secret  ');
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('choosing');
    });
    expect(store.deviceSecret()).toBe('device-secret');
  });
});
