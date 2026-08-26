import { Navigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';

import type { PropsWithChildren } from 'react';

/** The gate in front of the grown-up's screens (P2H-12). The API checks the token again. */
export function RequireParent({ children }: PropsWithChildren): React.JSX.Element | null {
  const { state } = useAuth();
  if (state.restoring) return null;
  if (state.parent === null) return <Navigate replace to="/sign-in" />;
  return <>{children}</>;
}
