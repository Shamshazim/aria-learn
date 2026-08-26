import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api';

import { createMemoryAdultTokenStore } from '../model/adult-token-store';

import { useAdultSignIn } from './useAdultSignIn';

import type { AdultAuthApi, AdultAuthResponse } from '../api/adult-auth.api';

const ADULT: AdultAuthResponse = {
  adultId: 'adult-1',
  role: 'parent',
  parentId: 'parent-1',
  sessionId: 'session-1',
};

/** A window with only the parts this flow touches. */
function fakeWindow(hash: string) {
  const replaceState = vi.fn();
  return {
    window: {
      location: { hash, pathname: '/grown-ups', search: '' },
      history: { replaceState },
    } as unknown as Window,
    replaceState,
  };
}

function fakeApi(overrides: Partial<AdultAuthApi> = {}): AdultAuthApi {
  return {
    requestMagicLink: () => Promise.resolve(null),
    signIn: () => Promise.resolve(ADULT),
    me: () => Promise.resolve(ADULT),
    signOut: () => Promise.resolve(null),
    ...overrides,
  };
}

describe('useAdultSignIn', () => {
  it('restores a session from a stored token', async () => {
    const store = createMemoryAdultTokenStore();
    store.remember('stored-token');
    const view = fakeWindow('');

    const { result } = renderHook(() =>
      useAdultSignIn({ api: fakeApi(), store, window: view.window }),
    );

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'signed_in', adult: ADULT });
    });
  });

  it('forgets a token the server no longer accepts', async () => {
    const store = createMemoryAdultTokenStore();
    store.remember('stale-token');
    const api = fakeApi({ me: () => Promise.reject(new ApiError('http', 'UNAUTHENTICATED', 401)) });

    const { result } = renderHook(() =>
      useAdultSignIn({ api, store, window: fakeWindow('').window }),
    );

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'signed_out', problem: null });
    });
    expect(store.token()).toBeNull();
  });

  it('takes the token out of the address bar before doing anything with it', async () => {
    const view = fakeWindow('#access_token=from-email&token_type=bearer');

    const { result } = renderHook(() =>
      useAdultSignIn({
        api: fakeApi(),
        store: createMemoryAdultTokenStore(),
        window: view.window,
      }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('attesting');
    });
    expect(view.replaceState).toHaveBeenCalledWith(null, '', '/grown-ups');
  });

  it('stores the token only once the attested sign-in succeeds', async () => {
    const store = createMemoryAdultTokenStore();
    const attempts: unknown[] = [];
    const api = fakeApi({
      signIn: (input) => {
        attempts.push(input);
        return Promise.resolve(ADULT);
      },
    });

    const { result } = renderHook(() =>
      useAdultSignIn({ api, store, window: fakeWindow('#access_token=from-email').window }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('attesting');
    });
    expect(store.token()).toBeNull();

    act(() => {
      result.current.attest({ role: 'parent' });
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'signed_in', adult: ADULT });
    });
    expect(attempts).toEqual([
      { accessToken: 'from-email', attestation: { isAdult: true, role: 'parent' } },
    ]);
    expect(store.token()).toBe('from-email');
  });

  it('keeps nothing when the server refuses the attested token', async () => {
    const store = createMemoryAdultTokenStore();
    const api = fakeApi({
      signIn: () => Promise.reject(new ApiError('http', 'UNAUTHENTICATED', 401)),
    });

    const { result } = renderHook(() =>
      useAdultSignIn({ api, store, window: fakeWindow('#access_token=expired').window }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('attesting');
    });
    act(() => {
      result.current.attest({ role: 'teacher' });
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'signed_out', problem: 'link_expired' });
    });
    expect(store.token()).toBeNull();
  });

  it('reports a provider error in the fragment as an expired link', async () => {
    const { result } = renderHook(() =>
      useAdultSignIn({
        api: fakeApi(),
        store: createMemoryAdultTokenStore(),
        window: fakeWindow('#error=access_denied&error_code=otp_expired').window,
      }),
    );

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'signed_out', problem: 'link_expired' });
    });
  });

  it('sends the link and says so', async () => {
    const sent: string[] = [];
    const api = fakeApi({
      requestMagicLink: (email) => {
        sent.push(email);
        return Promise.resolve(null);
      },
    });

    const { result } = renderHook(() =>
      useAdultSignIn({
        api,
        store: createMemoryAdultTokenStore(),
        window: fakeWindow('').window,
      }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe('signed_out');
    });
    act(() => {
      result.current.requestLink('parent@example.test');
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'link_sent',
        email: 'parent@example.test',
      });
    });
    expect(sent).toEqual(['parent@example.test']);
  });
});
