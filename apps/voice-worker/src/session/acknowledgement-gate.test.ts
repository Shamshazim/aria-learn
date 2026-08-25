import { describe, expect, it } from 'vitest';

import { createAcknowledgementGate } from './acknowledgement-gate';

describe('acknowledgement gate', () => {
  it('releases a worker that closes before the first browser acknowledgement', async () => {
    const gate = createAcknowledgementGate();

    gate.close();

    await expect(gate.wait()).resolves.toBe(false);
  });

  it('allows startup after the browser acknowledgement', async () => {
    const gate = createAcknowledgementGate();

    gate.acknowledge();

    await expect(gate.wait()).resolves.toBe(true);
  });

  it('remains closed when the participant leaves just after acknowledging', async () => {
    const gate = createAcknowledgementGate();

    gate.acknowledge();
    gate.close();

    await expect(gate.wait()).resolves.toBe(true);
    expect(gate.isClosed()).toBe(true);
  });
});
