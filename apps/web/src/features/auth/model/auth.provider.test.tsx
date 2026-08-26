import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChildSessionResponse, ChildSummary } from '@aria/shared';

import { ApiError } from '@/api';
import type { IdentityApi } from '@/features/auth/api/identity.api';
import type { ParentTokens, SupabaseApi } from '@/features/auth/api/supabase.api';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthProvider } from '@/features/auth/model/auth.provider';
import type { ParentSessionStore } from '@/features/auth/model/parent-session';

const NOW = new Date('2026-08-25T10:00:00.000Z');

const TOKENS: ParentTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: NOW.getTime() + 3_600_000,
};

const SAM: ChildSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Sam',
  grade: '4',
  band: 'middle',
  avatar: 'fox',
  loginMethod: 'pin',
};

const SESSION: ChildSessionResponse = {
  child: SAM,
  expiresAt: '2026-08-25T22:00:00.000Z',
  idleExpiresAt: '2026-08-25T10:30:00.000Z',
};

function memoryStore(seed: ParentTokens | null): ParentSessionStore {
  let held = seed;
  return {
    read: () => held,
    write: (tokens) => {
      held = tokens;
    },
    clear: () => {
      held = null;
    },
  };
}

function identity(overrides: Partial<IdentityApi> = {}): IdentityApi {
  return {
    children: () => Promise.resolve([SAM]),
    revokeAllSessions: () => Promise.resolve(0),
    login: () => Promise.resolve(SESSION),
    logout: () => Promise.resolve(),
    refresh: () => Promise.resolve(null),
    addChild: () => Promise.resolve(SAM),
    updateChild: () => Promise.resolve(SAM),
    grantVoiceConsent: () => Promise.resolve(),
    ...overrides,
  };
}

/** A consumer that renders the state and offers the two actions worth driving from a test. */
function Probe(): React.JSX.Element {
  const { state, signInChild, signInParent, signOutParent } = useAuth();
  return (
    <div>
      <p data-testid="state">
        {state.restoring
          ? 'restoring'
          : `parent:${String(state.parent !== null)} child:${state.child?.child.firstName ?? 'none'} problem:${state.problem ?? 'none'} children:${String(state.children.length)}`}
      </p>
      <button
        type="button"
        onClick={() => {
          void signInParent('grown.up@example.test', 'hunter2');
        }}
      >
        sign in parent
      </button>
      <button
        type="button"
        onClick={() => {
          void signInChild({ childId: SAM.id, pin: '4321' });
        }}
      >
        sign in child
      </button>
      <button type="button" onClick={signOutParent}>
        sign out parent
      </button>
    </div>
  );
}

function mount(
  deps: Readonly<{ identity?: IdentityApi; supabase?: SupabaseApi; store?: ParentSessionStore }>,
): void {
  render(
    <AuthProvider
      identity={deps.identity ?? identity()}
      now={() => NOW}
      store={deps.store ?? memoryStore(null)}
      supabase={deps.supabase}
    >
      <Probe />
    </AuthProvider>,
  );
}

/** `textContent` is non-null on a rendered element; the probe always writes one. */
const state = (): string => screen.getByTestId('state').textContent;

describe('who is using this device', () => {
  it('asks the server whether a child session already exists', async () => {
    const refresh = vi.fn(() => Promise.resolve(SESSION));
    mount({ identity: identity({ refresh }) });

    await waitFor(() => {
      expect(state()).toContain('child:Sam');
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('loads the picker for a remembered parent with no child signed in', async () => {
    mount({ store: memoryStore(TOKENS) });

    await waitFor(() => {
      expect(state()).toContain('children:1');
    });
    expect(state()).toContain('parent:true');
  });

  /** An expired remembered token is not a session, and is not kept around pretending to be. */
  it('forgets a remembered token that has already expired', async () => {
    const store = memoryStore({ ...TOKENS, expiresAt: NOW.getTime() - 1 });
    mount({ store });

    await waitFor(() => {
      expect(state()).toContain('parent:false');
    });
    expect(store.read()).toBeNull();
  });

  it('signs a parent in and remembers them', async () => {
    const store = memoryStore(null);
    const supabase: SupabaseApi = {
      signIn: () => Promise.resolve(TOKENS),
      refresh: () => Promise.resolve(TOKENS),
    };
    mount({ store, supabase });
    await waitFor(() => {
      expect(state()).toContain('parent:false');
    });

    await userEvent.click(screen.getByRole('button', { name: 'sign in parent' }));

    await waitFor(() => {
      expect(state()).toContain('parent:true');
    });
    expect(store.read()).toEqual(TOKENS);
  });

  it('says so plainly when this build cannot sign anybody in', async () => {
    mount({});
    await waitFor(() => {
      expect(state()).toContain('parent:false');
    });

    await userEvent.click(screen.getByRole('button', { name: 'sign in parent' }));

    await waitFor(() => {
      expect(state()).toContain('problem:sign-in-failed');
    });
  });

  it('signs a child in once a parent is there', async () => {
    mount({ store: memoryStore(TOKENS) });
    await waitFor(() => {
      expect(state()).toContain('children:1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'sign in child' }));

    await waitFor(() => {
      expect(state()).toContain('child:Sam');
    });
  });

  /** A locked child gets their own problem, so the screen can show the one fixed sentence. */
  it('tells a locked child apart from a wrong PIN', async () => {
    const login = vi.fn(() => Promise.reject(new ApiError('http', 'LOCKED', 423)));
    mount({ identity: identity({ login }), store: memoryStore(TOKENS) });
    await waitFor(() => {
      expect(state()).toContain('children:1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'sign in child' }));

    await waitFor(() => {
      expect(state()).toContain('problem:child-locked');
    });
  });

  /**
   * A Supabase access token lasts about an hour. Throwing the session away at expiry would
   * make a grown-up retype a password on the family tablet every hour.
   */
  it('renews a remembered token that has lapsed rather than discarding it', async () => {
    const renewed = { ...TOKENS, accessToken: 'renewed', expiresAt: NOW.getTime() + 3_600_000 };
    const refresh = vi.fn(() => Promise.resolve(renewed));
    const store = memoryStore({ ...TOKENS, expiresAt: NOW.getTime() - 1 });
    mount({ store, supabase: { signIn: () => Promise.resolve(TOKENS), refresh } });

    await waitFor(() => {
      expect(state()).toContain('parent:true');
    });
    expect(refresh).toHaveBeenCalledExactlyOnceWith('refresh');
    expect(store.read()).toEqual(renewed);
  });

  /** The ticket's "parent deleted in Supabase" case, as far as this device can see it. */
  it('forgets the parent and signs the child out when the token cannot be renewed', async () => {
    const logout = vi.fn(() => Promise.resolve());
    const store = memoryStore({ ...TOKENS, expiresAt: NOW.getTime() - 1 });
    mount({
      identity: identity({ logout, refresh: () => Promise.resolve(SESSION) }),
      store,
      supabase: {
        signIn: () => Promise.resolve(TOKENS),
        refresh: () => Promise.reject(new Error('user deleted')),
      },
    });

    await waitFor(() => {
      expect(state()).toContain('parent:false');
    });
    expect(store.read()).toBeNull();
    expect(logout).toHaveBeenCalled();
  });

  /** "A parent can revoke all child sessions" — the device is being handed back. */
  it('ends every session on the account when the grown-up signs the device out', async () => {
    const revokeAllSessions = vi.fn(() => Promise.resolve(2));
    mount({ identity: identity({ revokeAllSessions }), store: memoryStore(TOKENS) });
    await waitFor(() => {
      expect(state()).toContain('children:1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'sign out parent' }));

    await waitFor(() => {
      expect(state()).toContain('parent:false');
    });
    expect(revokeAllSessions).toHaveBeenCalledExactlyOnceWith('access');
  });

  it('reports a wrong PIN as its own problem', async () => {
    const login = vi.fn(() => Promise.reject(new ApiError('http', 'UNAUTHORIZED', 401)));
    mount({ identity: identity({ login }), store: memoryStore(TOKENS) });
    await waitFor(() => {
      expect(state()).toContain('children:1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'sign in child' }));

    await waitFor(() => {
      expect(state()).toContain('problem:child-sign-in-failed');
    });
  });
});
