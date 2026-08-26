import { useCallback, useEffect, useMemo, useReducer, type PropsWithChildren } from 'react';

import type { ChildSessionResponse } from '@aria/shared';

import { ApiError } from '@/api';
import type { IdentityApi } from '@/features/auth/api/identity.api';
import type { ParentTokens, SupabaseApi } from '@/features/auth/api/supabase.api';
import {
  AuthContext,
  type AuthContextValue,
  type ChildAttempt,
} from '@/features/auth/model/auth.context';
import { INITIAL_AUTH_STATE, reduceAuth, type AuthEvent } from '@/features/auth/model/auth.machine';
import { isUsable, type ParentSessionStore } from '@/features/auth/model/parent-session';

/**
 * Wiring only (P2H-12). Every decision it makes is one line long; the rest is in `model/`.
 *
 * On boot it asks two questions in parallel: does this browser remember a parent, and does
 * this device still hold a child session? The second one has to be asked of the server,
 * because the cookie that answers it is http-only and no script here can read it.
 */
export type AuthProviderDeps = Readonly<{
  identity: IdentityApi;
  supabase: SupabaseApi | undefined;
  store: ParentSessionStore;
  now?: () => Date;
}>;

export function AuthProvider({
  children,
  ...deps
}: PropsWithChildren<AuthProviderDeps>): React.JSX.Element {
  const [state, dispatch] = useReducer(reduceAuth, INITIAL_AUTH_STATE);
  const now = deps.now ?? (() => new Date());
  const parentToken = state.parent?.accessToken;

  useRestore(deps, now, dispatch);
  useParentRefresh(deps, state.parent, now, dispatch);
  useChildList(deps.identity, parentToken, state.child !== null, dispatch);

  const signInParent = useCallback(
    (email: string, password: string) => parentSignIn(deps, dispatch, email, password),
    [deps],
  );

  const signInChild = useCallback(
    async (attempt: ChildAttempt) => {
      if (parentToken === undefined) {
        dispatch({ kind: 'FAILED', problem: 'child-sign-in-failed' });
        return;
      }
      dispatch({ kind: 'BUSY' });
      try {
        dispatch({
          kind: 'CHILD_SIGNED_IN',
          child: await deps.identity.login(parentToken, attempt),
        });
      } catch (error) {
        dispatch({ kind: 'FAILED', problem: problemFor(error) });
      }
    },
    [deps.identity, parentToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signInParent,
      signInChild,
      ...sessionActions(deps, dispatch),
    }),
    [deps, signInChild, signInParent, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * A build with no Supabase project cannot sign anybody in, and says so through the same
 * failure a wrong password produces — the screen has one message either way.
 */
async function parentSignIn(
  deps: AuthProviderDeps,
  dispatch: Dispatch,
  email: string,
  password: string,
): Promise<void> {
  const supabase = deps.supabase;
  if (supabase === undefined) {
    dispatch({ kind: 'FAILED', problem: 'sign-in-failed' });
    return;
  }
  dispatch({ kind: 'BUSY' });
  try {
    const tokens = await supabase.signIn(email, password);
    deps.store.write(tokens);
    dispatch({ kind: 'PARENT_SIGNED_IN', parent: tokens });
  } catch {
    dispatch({ kind: 'FAILED', problem: 'sign-in-failed' });
  }
}

/** Ending a session, and keeping one alive. Neither needs any state to do its job. */
function sessionActions(
  deps: AuthProviderDeps,
  dispatch: Dispatch,
): Pick<AuthContextValue, 'signOutParent' | 'signOutChild' | 'keepAlive'> {
  return {
    /**
     * Handing the device back ends every session on the account, not just this one. A tablet
     * that was signed in in another room stops working too, which is what "a parent can revoke
     * all child sessions" is for.
     */
    signOutParent: () => {
      const token = deps.store.read()?.accessToken;
      deps.store.clear();
      if (token !== undefined) void deps.identity.revokeAllSessions(token).catch(() => undefined);
      void deps.identity.logout().catch(() => undefined);
      dispatch({ kind: 'PARENT_SIGNED_OUT' });
    },
    signOutChild: async () => {
      await deps.identity.logout();
      dispatch({ kind: 'CHILD_SIGNED_OUT' });
    },
    /**
     * Only a refusal ends the session. A keep-alive that could not be delivered leaves the
     * child exactly where they were — the server's own deadline is what decides, and losing
     * a signal for a moment is not the same as walking away.
     */
    keepAlive: async () => {
      try {
        const child = await deps.identity.refresh();
        dispatch(
          child === null ? { kind: 'CHILD_SIGNED_OUT' } : { kind: 'CHILD_SIGNED_IN', child },
        );
      } catch {
        /* offline, or a blip: nothing about who is signed in has changed. */
      }
    },
  };
}

type Dispatch = (event: AuthEvent) => void;

/**
 * Boot: what this browser remembers about the parent, and what the server says about the
 * child. The second question can only be asked of the server, because the cookie that answers
 * it is http-only and no script here can read it.
 */
function useRestore(deps: AuthProviderDeps, now: () => Date, dispatch: Dispatch): void {
  useEffect(() => {
    let cancelled = false;
    void Promise.all([rememberedParent(deps, now()), childSession(deps)]).then(
      ([parent, child]) => {
        if (!cancelled) dispatch({ kind: 'RESTORED', parent, child });
      },
    );
    return () => {
      cancelled = true;
    };
    // Boot happens once, on purpose. Re-running it would sign a child out every time a
    // dependency's identity changed, which is what the module-scope api objects exist to
    // prevent — but a deliberately empty dependency list says so where it cannot be missed.
  }, []);
}

/**
 * The remembered parent, renewed rather than discarded where it can be.
 *
 * A Supabase access token lasts about an hour and the picker sits behind it, so throwing the
 * session away at expiry would mean a grown-up retyping a password on the family tablet every
 * hour — which is the opposite of what "the picker alone suffices" is for.
 */
async function rememberedParent(deps: AuthProviderDeps, at: Date): Promise<ParentTokens | null> {
  const remembered = deps.store.read();
  if (remembered === null) return null;
  if (isUsable(remembered, at)) return remembered;
  return renewParent(deps, remembered);
}

/**
 * A refusal to renew is the answer to the ticket's "parent deleted in Supabase" case, as far
 * as this device can see it: the remembered token goes, and the child on this device is signed
 * out with it. Sessions on *other* devices end when those devices next fail to renew — there
 * is no push from Supabase telling us sooner.
 */
async function renewParent(
  deps: AuthProviderDeps,
  remembered: ParentTokens,
): Promise<ParentTokens | null> {
  const supabase = deps.supabase;
  if (supabase === undefined) {
    deps.store.clear();
    return null;
  }
  try {
    const renewed = await supabase.refresh(remembered.refreshToken);
    deps.store.write(renewed);
    return renewed;
  } catch {
    deps.store.clear();
    await deps.identity.logout().catch(() => undefined);
    return null;
  }
}

/** Whether this device already holds a child session. Unreachable is not "signed out". */
async function childSession(deps: AuthProviderDeps): Promise<ChildSessionResponse | null> {
  try {
    return await deps.identity.refresh();
  } catch {
    return null;
  }
}

/**
 * Renews the parent's token a few minutes before it lapses, so nothing a family is in the
 * middle of is interrupted by an expiry they cannot see.
 */
const RENEW_MARGIN_MS = 5 * 60 * 1_000;

function useParentRefresh(
  deps: AuthProviderDeps,
  parent: ParentTokens | null,
  now: () => Date,
  dispatch: Dispatch,
): void {
  useEffect(() => {
    if (parent === null) return;
    const delay = Math.max(0, parent.expiresAt - RENEW_MARGIN_MS - now().getTime());
    const timer = window.setTimeout(() => {
      void renewParent(deps, parent).then((renewed) => {
        dispatch(
          renewed === null
            ? { kind: 'PARENT_SIGNED_OUT' }
            : { kind: 'PARENT_SIGNED_IN', parent: renewed },
        );
      });
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [deps, dispatch, now, parent]);
}

/** The picker's list, loaded whenever a parent is signed in and no child is yet. */
function useChildList(
  identity: IdentityApi,
  parentToken: string | undefined,
  childSignedIn: boolean,
  dispatch: Dispatch,
): void {
  useEffect(() => {
    if (parentToken === undefined || childSignedIn) return;
    let cancelled = false;
    void identity.children(parentToken).then(
      (loaded) => {
        if (!cancelled) dispatch({ kind: 'CHILDREN_LOADED', children: loaded });
      },
      () => {
        if (!cancelled) dispatch({ kind: 'FAILED', problem: 'offline' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [childSignedIn, dispatch, identity, parentToken]);
}

/** A locked child gets their own screen; everything else is one "that did not work". */
function problemFor(error: unknown): 'child-locked' | 'child-sign-in-failed' {
  return error instanceof ApiError && error.code === 'LOCKED'
    ? 'child-locked'
    : 'child-sign-in-failed';
}
