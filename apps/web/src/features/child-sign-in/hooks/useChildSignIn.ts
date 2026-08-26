import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { PictureSecret, SecretPictureKey } from '@aria/shared';

import { ApiError } from '@/api';

import {
  completedSecret,
  initialSignInState,
  signInReducer,
  type SignInEvent,
  type SignInState,
} from '../model/sign-in.machine';

import type { ChildAuthApi, ChildProfile, ChildSession } from '../api/child-auth.api';
import type { CredentialStore } from '../model/credential-store';

/**
 * The one place the child sign-in screen talks to the network.
 *
 * Everything it does is a dispatch into `signInReducer`, so what the screen shows next is
 * decided by the machine and is testable without a browser (§3.2). The two effects are the two
 * requests: load the profiles this device may open, and open a session once four pictures have
 * been tapped. The child never presses "go" — the fourth tap is the submit.
 */
export type ChildSignInViewModel = Readonly<{
  state: SignInState;
  choose(studentId: string): void;
  tap(picture: SecretPictureKey): void;
  undo(): void;
  /** Back to the picker, or out of a lockout screen into a fresh load. */
  back(): void;
  /** A grown-up entering the setup code the parent console gave them for this device. */
  linkDevice(secret: string): void;
  /** After a load failure that was not an authorisation failure. */
  retry(): void;
}>;

export type ChildSignInDeps = Readonly<{
  api: ChildAuthApi;
  store: CredentialStore;
  /** Where the app goes once the child is in. Called after the token is stored. */
  onSignedIn?: (session: ChildSession, profile: ChildProfile) => void;
}>;

/** What a screen falls back to when a 429 arrived without a `Retry-After` to count down. */
const FALLBACK_LOCKOUT_SECONDS = 15 * 60;

export function useChildSignIn(deps: ChildSignInDeps): ChildSignInViewModel {
  const [state, dispatch] = useReducer(signInReducer, initialSignInState);
  const [reloads, setReloads] = useState(0);
  const latest = useLatest(deps);
  const begin = useRequestSlot();

  // The picker's contents. A device with no grant and a revoked one are the same screen, and
  // `reloads` is what a setup code or a retry bumps to run this again.
  const loading = state.status === 'loading' || state.status === 'needs_device';
  useEffect(() => {
    if (loading) loadProfiles(latest.current, begin(), dispatch);
  }, [latest, begin, loading, reloads]);

  // The fourth tap. `completedSecret` is null again the moment this starts, so it runs once.
  const secret = completedSecret(state);
  const profile = state.status === 'secret' ? state.profile : null;
  useEffect(() => {
    if (secret !== null && profile !== null) {
      openSession(latest.current, { secret, profile }, begin(), dispatch);
    }
  }, [latest, begin, secret, profile]);

  const reload = useCallback(() => {
    setReloads((count) => count + 1);
  }, []);

  return {
    state,
    choose: (studentId) => {
      dispatch({ type: 'profile_chosen', studentId });
    },
    tap: (picture) => {
      dispatch({ type: 'tapped', picture });
    },
    undo: () => {
      dispatch({ type: 'undo' });
    },
    back: () => {
      dispatch({ type: 'back' });
    },
    linkDevice: (secret) => {
      latest.current.store.rememberDevice(secret.trim());
      reload();
    },
    retry: reload,
  };
}

type Dispatch = (event: SignInEvent) => void;

/**
 * The dependencies, always current, and never a reason to re-run an effect.
 *
 * They are ports — an api and a credential store — so "they changed" is not an event this
 * flow should react to. Reading them through a ref also means a page that builds its api
 * inline cannot start a request loop, which is a mistake worth making impossible.
 */
function useLatest(deps: ChildSignInDeps) {
  const ref = useRef(deps);
  useEffect(() => {
    ref.current = deps;
  });
  return ref;
}

/**
 * One request at a time, cancelled only by unmounting.
 *
 * Deliberately not an effect cleanup: the effects here dispatch as they start, so React tears
 * the effect down mid-flight and a cleanup-based abort would cancel the very request it just
 * made. A new request supersedes the previous one, and leaving the screen cancels whatever is
 * open.
 */
function useRequestSlot(): () => AbortSignal {
  const current = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      current.current?.abort();
    },
    [],
  );

  return useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    return controller.signal;
  }, []);
}

function loadProfiles(deps: ChildSignInDeps, signal: AbortSignal, dispatch: Dispatch): void {
  const { api, store } = deps;
  const deviceSecret = store.deviceSecret();
  if (deviceSecret === null || deviceSecret === '') {
    dispatch({ type: 'device_missing' });
    return;
  }

  void api.profiles(deviceSecret, signal).then(
    (profiles) => {
      if (!signal.aborted) dispatch({ type: 'profiles_loaded', profiles });
    },
    (error: unknown) => {
      if (signal.aborted) return;
      // A grant the server no longer honours is worth forgetting, so the next visit asks for
      // a code instead of retrying a secret that will never work again.
      if (isUnauthenticated(error)) store.forgetDevice();
      dispatch({ type: 'device_missing' });
    },
  );
}

function openSession(
  deps: ChildSignInDeps,
  attempt: Readonly<{ secret: PictureSecret; profile: ChildProfile }>,
  signal: AbortSignal,
  dispatch: Dispatch,
): void {
  const { api, store, onSignedIn } = deps;
  const deviceSecret = store.deviceSecret();
  if (deviceSecret === null) {
    dispatch({ type: 'device_missing' });
    return;
  }

  dispatch({ type: 'submitting' });

  const input = {
    deviceSecret,
    studentId: attempt.profile.studentId,
    pictureSecret: attempt.secret,
  };
  void api.open(input, signal).then(
    (session) => {
      if (signal.aborted) return;
      store.rememberSession(session.token);
      dispatch({ type: 'opened' });
      onSignedIn?.(session, attempt.profile);
    },
    (error: unknown) => {
      if (!signal.aborted) dispatch(failureEvent(error));
    },
  );
}

/**
 * The server refuses a wrong secret and an unauthorised device with the same message on
 * purpose. Only the throttle is distinguishable, and only because a locked-out child has to be
 * told to wait rather than left tapping.
 */
function failureEvent(error: unknown): SignInEvent {
  if (error instanceof ApiError && error.code === 'TOO_MANY_ATTEMPTS') {
    return { type: 'locked_out', seconds: error.retryAfterSeconds ?? FALLBACK_LOCKOUT_SECONDS };
  }
  return { type: 'wrong_secret' };
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
