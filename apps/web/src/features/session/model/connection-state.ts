export type ConnectionStatus = 'online' | 'degraded' | 'offline';

export type ConnectionState = Readonly<{ status: ConnectionStatus }>;
export type ConnectionAction =
  | Readonly<{ kind: 'PROVIDER_FAILED' }>
  | Readonly<{ kind: 'CONTENT_EXHAUSTED' }>
  | Readonly<{ kind: 'CONNECTION_RESTORED' }>;

export const ONLINE: ConnectionState = { status: 'online' };

export function reduceConnection(
  state: ConnectionState,
  action: ConnectionAction,
): ConnectionState {
  if (action.kind === 'PROVIDER_FAILED') {
    return state.status === 'offline' ? state : { status: 'degraded' };
  }
  if (action.kind === 'CONTENT_EXHAUSTED') return { status: 'offline' };
  return ONLINE;
}
