import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type PropsWithChildren } from 'react';

import { webConfig } from '@/app/config';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export type WebConfig = Readonly<{ apiBaseUrl: string }>;
export const WebConfigContext = createContext<WebConfig>(webConfig);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function AppProviders({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <ErrorBoundary>
      <WebConfigContext.Provider value={webConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WebConfigContext.Provider>
    </ErrorBoundary>
  );
}
