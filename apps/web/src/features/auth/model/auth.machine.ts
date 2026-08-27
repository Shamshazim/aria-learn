import type { ChildSessionResponse, ChildSummary } from '@aria/shared';

import type { ParentTokens } from '@/features/auth/api/supabase.api';

/**
 * Who is signed in on this device, as a state machine (P2H-12).
 *
 * Two independent facts, not one: a parent can be signed in with no child using the device —
 * that is the picker — and a child can be part way through a session while their parent's own
 * token has expired. Collapsing them into one "logged in" flag is what would make the second
 * case log a child out mid-question.
 *
 * Pure and framework-free, so the sequencing can be tested without rendering anything.
 */
export type AuthState = Readonly<{
  /** True until the app has asked the API whether this device already has a child session. */
  restoring: boolean;
  parent: ParentTokens | null;
  child: ChildSessionResponse | null;
  children: readonly ChildSummary[];
  /** The last thing that went wrong, for the screen to show. Cleared by the next attempt. */
  problem: AuthProblem | null;
  busy: boolean;
}>;

export type AuthProblem = 'sign-in-failed' | 'child-sign-in-failed' | 'child-locked' | 'offline';

export type AuthEvent =
  | Readonly<{ kind: 'RESTORED'; parent: ParentTokens | null; child: ChildSessionResponse | null }>
  | Readonly<{ kind: 'BUSY' }>
  | Readonly<{ kind: 'PARENT_SIGNED_IN'; parent: ParentTokens }>
  | Readonly<{ kind: 'PARENT_SIGNED_OUT' }>
  | Readonly<{ kind: 'CHILDREN_LOADED'; children: readonly ChildSummary[] }>
  | Readonly<{ kind: 'CHILD_SIGNED_IN'; child: ChildSessionResponse }>
  | Readonly<{ kind: 'CHILD_SIGNED_OUT' }>
  | Readonly<{ kind: 'FAILED'; problem: AuthProblem }>;

export const INITIAL_AUTH_STATE: AuthState = {
  restoring: true,
  parent: null,
  child: null,
  children: [],
  problem: null,
  busy: false,
};

export function reduceAuth(state: AuthState, event: AuthEvent): AuthState {
  switch (event.kind) {
    case 'RESTORED':
      return { ...state, restoring: false, parent: event.parent, child: event.child };
    case 'BUSY':
      return { ...state, busy: true, problem: null };
    case 'PARENT_SIGNED_IN':
      return { ...state, busy: false, problem: null, parent: event.parent };
    // Signing the grown-up out takes the child with them: the device is being handed back.
    case 'PARENT_SIGNED_OUT':
      return { ...INITIAL_AUTH_STATE, restoring: false };
    case 'CHILDREN_LOADED':
      return { ...state, busy: false, children: event.children };
    case 'CHILD_SIGNED_IN':
      return { ...state, busy: false, problem: null, child: event.child };
    case 'CHILD_SIGNED_OUT':
      return { ...state, busy: false, child: null };
    case 'FAILED':
      return { ...state, busy: false, problem: event.problem };
  }
}

/** Where the router should send somebody in this state. */
export function landingFor(state: AuthState): '/loading' | '/sign-in' | '/who' | '/' {
  if (state.restoring) return '/loading';
  if (state.child !== null) return '/';
  return state.parent === null ? '/sign-in' : '/who';
}
