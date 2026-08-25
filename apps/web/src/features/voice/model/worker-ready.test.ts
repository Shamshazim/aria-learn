import { describe, expect, it } from 'vitest';

import { workerReadyAcknowledgement } from './worker-ready';

describe('worker-ready handshake', () => {
  it('replies with the current cursor after voice is enabled', () => {
    expect(workerReadyAcknowledgement({ kind: 'WORKER_READY' }, true, 7)).toEqual({
      kind: 'ACK',
      acknowledgedSeq: 7,
    });
  });

  it('waits for the enable action when voice is not enabled', () => {
    expect(workerReadyAcknowledgement({ kind: 'WORKER_READY' }, false, 7)).toBeNull();
  });
});
