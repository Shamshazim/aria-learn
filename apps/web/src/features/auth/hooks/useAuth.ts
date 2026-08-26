import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/features/auth/model/auth.context';

/** Who is using this device. The provider is mounted in `app/providers.tsx` (P2H-12). */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
