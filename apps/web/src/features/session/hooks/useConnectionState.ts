import { useEffect, useReducer } from 'react';

import {
  ONLINE,
  reduceConnection,
  type ConnectionState,
} from '@/features/session/model/connection-state';

export function useConnectionState(): ConnectionState {
  const [state, dispatch] = useReducer(
    reduceConnection,
    navigator.onLine ? ONLINE : { status: 'offline' },
  );
  useEffect(() => {
    const wentOffline = (): void => {
      dispatch({ kind: 'CONTENT_EXHAUSTED' });
    };
    const cameOnline = (): void => {
      dispatch({ kind: 'CONNECTION_RESTORED' });
    };
    window.addEventListener('offline', wentOffline);
    window.addEventListener('online', cameOnline);
    return () => {
      window.removeEventListener('offline', wentOffline);
      window.removeEventListener('online', cameOnline);
    };
  }, []);
  return state;
}
