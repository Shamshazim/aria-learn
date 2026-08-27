import { describe, expect, it } from 'vitest';

import type { ChildSessionResponse } from '@aria/shared';

import type { ParentTokens } from '@/features/auth/api/supabase.api';
import {
  INITIAL_AUTH_STATE,
  landingFor,
  reduceAuth,
  type AuthState,
} from '@/features/auth/model/auth.machine';

const PARENT: ParentTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.parse('2026-08-25T12:00:00.000Z'),
};

const CHILD: ChildSessionResponse = {
  child: {
    id: '00000000-0000-4000-8000-000000000001',
    firstName: 'Sam',
    grade: '4',
    band: 'middle',
    avatar: 'fox',
    loginMethod: 'pin',
  },
  expiresAt: '2026-08-25T22:00:00.000Z',
  idleExpiresAt: '2026-08-25T10:30:00.000Z',
};

const ready: AuthState = { ...INITIAL_AUTH_STATE, restoring: false };

describe('who is signed in', () => {
  it('starts out not knowing, and sends nobody anywhere until it does', () => {
    expect(INITIAL_AUTH_STATE.restoring).toBe(true);
    expect(landingFor(INITIAL_AUTH_STATE)).toBe('/loading');
  });

  it('restores both facts independently', () => {
    const state = reduceAuth(INITIAL_AUTH_STATE, {
      kind: 'RESTORED',
      parent: PARENT,
      child: null,
    });

    expect(state).toMatchObject({ restoring: false, parent: PARENT, child: null });
    expect(landingFor(state)).toBe('/who');
  });

  /** A child part way through a lesson stays there even if the grown-up's token has lapsed. */
  it('keeps a child session that has no parent behind it', () => {
    const state = reduceAuth(INITIAL_AUTH_STATE, { kind: 'RESTORED', parent: null, child: CHILD });

    expect(landingFor(state)).toBe('/');
  });

  it('sends a device nobody has signed in on to the grown-up', () => {
    expect(landingFor(ready)).toBe('/sign-in');
  });

  it('clears the problem when the next attempt starts', () => {
    const failed = reduceAuth(ready, { kind: 'FAILED', problem: 'child-locked' });

    expect(failed.problem).toBe('child-locked');
    expect(reduceAuth(failed, { kind: 'BUSY' }).problem).toBeNull();
  });

  /** Handing the device back takes the child with it. */
  it('signs the child out when the parent signs out', () => {
    const both = reduceAuth(reduceAuth(ready, { kind: 'PARENT_SIGNED_IN', parent: PARENT }), {
      kind: 'CHILD_SIGNED_IN',
      child: CHILD,
    });

    const out = reduceAuth(both, { kind: 'PARENT_SIGNED_OUT' });

    expect(out).toEqual({ ...INITIAL_AUTH_STATE, restoring: false });
  });

  it('leaves the parent alone when only the child signs out', () => {
    const both = reduceAuth(reduceAuth(ready, { kind: 'PARENT_SIGNED_IN', parent: PARENT }), {
      kind: 'CHILD_SIGNED_IN',
      child: CHILD,
    });

    const out = reduceAuth(both, { kind: 'CHILD_SIGNED_OUT' });

    expect(out).toMatchObject({ parent: PARENT, child: null });
    expect(landingFor(out)).toBe('/who');
  });

  it('stops being busy however an attempt ends', () => {
    const busy = reduceAuth(ready, { kind: 'BUSY' });

    expect(reduceAuth(busy, { kind: 'CHILD_SIGNED_IN', child: CHILD }).busy).toBe(false);
    expect(reduceAuth(busy, { kind: 'FAILED', problem: 'offline' }).busy).toBe(false);
    expect(reduceAuth(busy, { kind: 'CHILDREN_LOADED', children: [] }).busy).toBe(false);
  });
});
