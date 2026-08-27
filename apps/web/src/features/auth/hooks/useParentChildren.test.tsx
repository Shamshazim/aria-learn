import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ChildSummary } from '@aria/shared';

import type { IdentityApi } from '@/features/auth/api/identity.api';
import { useParentChildren } from '@/features/auth/hooks/useParentChildren';

const SAM: ChildSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Sam',
  grade: '4',
  band: 'middle',
  avatar: 'fox',
  loginMethod: 'none',
};

function identity(overrides: Partial<IdentityApi> = {}): IdentityApi {
  return {
    children: () => Promise.resolve([SAM]),
    revokeAllSessions: () => Promise.resolve(0),
    login: () => Promise.reject(new Error('not used')),
    logout: () => Promise.resolve(),
    refresh: () => Promise.resolve(null),
    addChild: () => Promise.resolve(SAM),
    updateChild: () => Promise.resolve(SAM),
    grantVoiceConsent: () => Promise.resolve(),
    ...overrides,
  };
}

describe('the grown-up list of children', () => {
  it('loads the list once a parent token is there', async () => {
    const { result } = renderHook(() => useParentChildren(identity(), 'parent-token'));

    await waitFor(() => {
      expect(result.current.children).toEqual([SAM]);
    });
  });

  it('asks for nothing at all without a token', () => {
    const children = vi.fn();
    renderHook(() => useParentChildren(identity({ children }), null));

    expect(children).not.toHaveBeenCalled();
  });

  /** A write that lands has to be visible without the page being reloaded. */
  it('reloads the list after an edit', async () => {
    const children = vi
      .fn()
      .mockResolvedValueOnce([SAM])
      .mockResolvedValue([{ ...SAM, loginMethod: 'pin' }]);
    const updateChild = vi.fn(() => Promise.resolve({ ...SAM, loginMethod: 'pin' as const }));
    const { result } = renderHook(() =>
      useParentChildren(identity({ children, updateChild }), 'parent-token'),
    );
    await waitFor(() => {
      expect(result.current.children).toHaveLength(1);
    });

    await result.current.update(SAM.id, { login: { pin: '4321' } });

    await waitFor(() => {
      expect(result.current.children[0]?.loginMethod).toBe('pin');
    });
    expect(updateChild).toHaveBeenCalledWith('parent-token', SAM.id, { login: { pin: '4321' } });
  });

  it('says plainly when a write did not land, and stops being busy either way', async () => {
    const addChild = vi.fn(() => Promise.reject(new Error('conflict')));
    const { result } = renderHook(() => useParentChildren(identity({ addChild }), 'parent-token'));
    await waitFor(() => {
      expect(result.current.children).toHaveLength(1);
    });

    await result.current.add({ displayName: 'Ada', grade: '2' });

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.busy).toBe(false);
  });

  it('grants voice consent through the same path', async () => {
    const grantVoiceConsent = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() =>
      useParentChildren(identity({ grantVoiceConsent }), 'parent-token'),
    );

    await result.current.allowVoice(SAM.id);

    expect(grantVoiceConsent).toHaveBeenCalledWith('parent-token', SAM.id);
  });
});
