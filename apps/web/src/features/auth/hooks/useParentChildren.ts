import { useCallback, useEffect, useState } from 'react';

import type { ChildPicture, ChildSummary, Grade } from '@aria/shared';

import type { ChildProfileInput, IdentityApi } from '@/features/auth/api/identity.api';

/**
 * The grown-up's list of children, and the edits they can make to it (P2H-12).
 *
 * A hook rather than the auth context: the picker needs the list on every device, but adding a
 * child and setting a PIN belong to one screen, and a context that carried them would put a
 * write path behind every child screen in the app.
 */
export type ParentChildrenView = Readonly<{
  children: readonly ChildSummary[];
  busy: boolean;
  failed: boolean;
  add(input: Readonly<{ displayName: string; grade: Grade; avatar?: ChildPicture }>): Promise<void>;
  update(childId: string, input: ChildProfileInput): Promise<void>;
  allowVoice(childId: string): Promise<void>;
}>;

export function useParentChildren(api: IdentityApi, token: string | null): ParentChildrenView {
  const [children, setChildren] = useState<readonly ChildSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (token === null) return;
    setChildren(await api.children(token));
  }, [api, token]);

  useEffect(() => {
    let cancelled = false;
    void reload().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  /** One shape for both writes: try, reload, and say plainly when it did not work. */
  const write = useCallback(
    async (perform: (parentToken: string) => Promise<unknown>) => {
      if (token === null) return;
      setBusy(true);
      setFailed(false);
      try {
        await perform(token);
        await reload();
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [reload, token],
  );

  return {
    children,
    busy,
    failed,
    add: (input) => write((parentToken) => api.addChild(parentToken, input)),
    update: (childId, input) =>
      write((parentToken) => api.updateChild(parentToken, childId, input)),
    allowVoice: (childId) => write((parentToken) => api.grantVoiceConsent(parentToken, childId)),
  };
}
