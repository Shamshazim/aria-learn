import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ApiError } from '@/api';

import {
  adultAuthReducer,
  initialAdultAuthState,
  type AdultAuthEvent,
  type AdultAuthState,
} from '../model/adult-auth.machine';
import { clearMagicLinkReturn, readMagicLinkReturn } from '../model/magic-link-return';

import type { AdultAuthApi, AdultRole } from '../api/adult-auth.api';
import type { AdultTokenStore } from '../model/adult-token-store';

/**
 * The grown-up sign-in flow, wired to the network.
 *
 * The first thing it does is look at the URL fragment, because the most common way to reach
 * this screen is by clicking a link in an email. Only if there is nothing there does it fall
 * back to asking the server whether the token this browser already holds is still good — the
 * server is the only thing that knows, since it enforces its own idle and absolute windows on
 * top of the provider's.
 */
export type AdultSignInViewModel = Readonly<{
  state: AdultAuthState;
  requestLink(email: string): void;
  /** The age gate. Submitting it is what creates the identity, so it carries the attestation. */
  attest(input: Readonly<{ role: AdultRole; displayName?: string }>): void;
  signOut(): void;
}>;

export type AdultSignInDeps = Readonly<{
  api: AdultAuthApi;
  store: AdultTokenStore;
  /** Injected so a test does not need a real address bar. */
  window?: Window;
}>;

export function useAdultSignIn(deps: AdultSignInDeps): AdultSignInViewModel {
  const [state, dispatch] = useReducer(adultAuthReducer, initialAdultAuthState);
  const latest = useRef(deps);
  useEffect(() => {
    latest.current = deps;
  });

  useEffect(() => {
    void begin(latest.current, dispatch);
  }, []);

  const requestLink = useCallback((email: string) => {
    const { api } = latest.current;
    dispatch({ type: 'link_requested', email });
    void api.requestMagicLink(email).then(
      () => {
        dispatch({ type: 'link_sent' });
      },
      () => {
        dispatch({ type: 'link_failed' });
      },
    );
  }, []);

  const attest = useCallback(
    (input: Readonly<{ role: AdultRole; displayName?: string }>) => {
      if (state.status !== 'attesting') return;
      const accessToken = state.accessToken;
      dispatch({ type: 'attested' });
      void signIn(latest.current, { accessToken, ...input }, dispatch);
    },
    [state],
  );

  const signOut = useCallback(() => {
    const { api, store } = latest.current;
    const token = store.token();
    store.forget();
    dispatch({ type: 'signed_out' });
    if (token !== null) void api.signOut(token).catch(() => null);
  }, []);

  return { state, requestLink, attest, signOut };
}

type Dispatch = (event: AdultAuthEvent) => void;

/** Fragment first, stored token second, signed out last. */
async function begin(deps: AdultSignInDeps, dispatch: Dispatch): Promise<void> {
  const view = deps.window ?? globalThis.window;
  const returned = readMagicLinkReturn(view.location.hash);

  if (returned.kind !== 'none') clearMagicLinkReturn(view);
  if (returned.kind === 'token') {
    dispatch({ type: 'token_returned', accessToken: returned.accessToken });
    return;
  }
  if (returned.kind === 'error') {
    dispatch({ type: 'link_rejected' });
    return;
  }

  const stored = deps.store.token();
  if (stored === null) {
    dispatch({ type: 'no_session' });
    return;
  }

  try {
    dispatch({ type: 'restored', adult: await deps.api.me(stored) });
  } catch {
    // Expired, revoked, or a server that cannot say — either way this browser is signed out,
    // and keeping the token would only make the next request fail the same way.
    deps.store.forget();
    dispatch({ type: 'no_session' });
  }
}

async function signIn(
  deps: AdultSignInDeps,
  input: Readonly<{ accessToken: string; role: AdultRole; displayName?: string }>,
  dispatch: Dispatch,
): Promise<void> {
  try {
    const adult = await deps.api.signIn({
      accessToken: input.accessToken,
      attestation: {
        isAdult: true,
        role: input.role,
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      },
    });
    deps.store.remember(input.accessToken);
    dispatch({ type: 'signed_in', adult });
  } catch (error: unknown) {
    dispatch({ type: 'sign_in_failed', problem: problemFor(error) });
  }
}

/** A refused token and a refused attestation land in the same place; only the wording differs. */
function problemFor(error: unknown): 'link_expired' | 'sign_in_failed' {
  return error instanceof ApiError && error.status === 401 ? 'link_expired' : 'sign_in_failed';
}
