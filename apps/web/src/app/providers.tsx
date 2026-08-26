import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type PropsWithChildren } from 'react';

import { createApiClient } from '@/api';
import { webConfig, type WebConfig } from '@/app/config';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  AuthProvider,
  createIdentityApi,
  createParentSessionStore,
  createSupabaseApi,
} from '@/features/auth';

export const WebConfigContext = createContext<WebConfig>(webConfig);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

/**
 * P2H-12: built once, at module scope, because a new api object on every render would restart
 * the effects that depend on it — including the one that asks whether a child is signed in.
 */
const identityApi = createIdentityApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));
const supabaseApi =
  webConfig.supabase === undefined ? undefined : createSupabaseApi(webConfig.supabase);
const parentStore = createParentSessionStore(window.localStorage);

export function AppProviders({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <ErrorBoundary>
      <WebConfigContext.Provider value={webConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider identity={identityApi} store={parentStore} supabase={supabaseApi}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </WebConfigContext.Provider>
    </ErrorBoundary>
  );
}
