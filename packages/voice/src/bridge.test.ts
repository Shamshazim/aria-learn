import { describe, expect, it } from 'vitest';

import { bridgeTextIsNonCommittal, classifyBridgeByRule, mayPlayBridge } from './bridge';

describe('bridge selection', () => {
  it('only classifies a harmless bucket and cannot judge the answer', () => {
    expect(classifyBridgeByRule("I don't know").intent).toBe('stuck');
    expect(classifyBridgeByRule('why does that work?').intent).toBe('question');
    expect(bridgeTextIsNonCommittal('Let me check.')).toBe(true);
    expect(bridgeTextIsNonCommittal('Yes, that is right.')).toBe(false);
  });

  it('skips bridges after interrupts, when content is ready, or before human approval', () => {
    expect(mayPlayBridge({ interrupted: true, contentReady: false, assetApproved: true })).toBe(
      false,
    );
    expect(mayPlayBridge({ interrupted: false, contentReady: true, assetApproved: true })).toBe(
      false,
    );
    expect(mayPlayBridge({ interrupted: false, contentReady: false, assetApproved: false })).toBe(
      false,
    );
  });
});
