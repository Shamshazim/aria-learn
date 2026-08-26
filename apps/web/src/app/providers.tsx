import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type PropsWithChildren } from 'react';

import { webConfig, type WebConfig } from '@/app/config';
import { identityApi, parentSessionStore, supabaseApi } from '@/app/services';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/features/auth';

export const WebConfigContext = createContext<WebConfig>(webConfig);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function AppProviders({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <ErrorBoundary>
      <WebConfigContext.Provider value={webConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider identity={identityApi} store={parentSessionStore} supabase={supabaseApi}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </WebConfigContext.Provider>
    </ErrorBoundary>
  );
}
