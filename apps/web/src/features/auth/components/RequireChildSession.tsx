import { Navigate, useLocation } from 'react-router-dom';

import { IdleNotice } from '@/features/auth/components/IdleNotice';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useIdleWatch } from '@/features/auth/hooks/useIdleWatch';
import { landingFor } from '@/features/auth/model/auth.machine';

import type { PropsWithChildren } from 'react';

/**
 * The gate in front of every child screen (P2H-12).
 *
 * It is a convenience, not a lock — the API refuses an unauthenticated request whatever this
 * component renders. What it buys is that a child never sees a screen full of failed requests:
 * they land on the picker instead.
 */
export function RequireChildSession({ children }: PropsWithChildren): React.JSX.Element | null {
  const { state, keepAlive } = useAuth();
  const location = useLocation();
  const idle = useIdleWatch(
    state.child === null ? null : new Date(state.child.idleExpiresAt),
    keepAlive,
  );
  if (state.restoring) return null;
  if (state.child === null) {
    return <Navigate replace state={{ from: location.pathname }} to={landingFor(state)} />;
  }
  return (
    <>
      {idle === 'warning' ? <IdleNotice /> : null}
      {children}
    </>
  );
}
