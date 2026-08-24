import { describe, expect, it } from 'vitest';

import { ONLINE, reduceConnection } from '@/features/session/model/connection-state';

describe('connection state', () => {
  it('moves through provider degradation, exhaustion and automatic recovery', () => {
    const degraded = reduceConnection(ONLINE, { kind: 'PROVIDER_FAILED' });
    const offline = reduceConnection(degraded, { kind: 'CONTENT_EXHAUSTED' });
    const recovered = reduceConnection(offline, { kind: 'CONNECTION_RESTORED' });

    expect(degraded.status).toBe('degraded');
    expect(offline.status).toBe('offline');
    expect(recovered).toBe(ONLINE);
  });

  it('does not downgrade an exhausted connection to merely degraded', () => {
    const offline = { status: 'offline' } as const;

    expect(reduceConnection(offline, { kind: 'PROVIDER_FAILED' })).toBe(offline);
  });
});
