import { describe, expect, it } from 'vitest';

import { bridgeTextIsNonCommittal, chooseBridge } from './bridge';
import { createBridgePicker, type BridgeClip } from './bridge-picker';

import type { BridgeContext } from './bridge-rules';

const CLIPS: readonly BridgeClip[] = [
  {
    id: 'clip-ack',
    bucket: 'acknowledge',
    band: 'middle',
    voice: 'voice-middle',
    text: 'Okay, let me see.',
    durationMs: 900,
  },
];

const CONTEXT: BridgeContext = {
  intent: 'ANSWER',
  band: 'middle',
  afterMoveKind: 'ASK',
  expectedFirstAudioMs: 1_100,
  childSpeaking: false,
  turnsSinceBridge: null,
};

describe('bridge selection', () => {
  it('covers the gap with a recorded clip from the bucket the rules chose', () => {
    expect(
      chooseBridge({
        context: CONTEXT,
        clips: CLIPS,
        picker: createBridgePicker({ seed: 1 }),
        turnIndex: 0,
      }),
    ).toEqual({ play: true, clip: CLIPS[0] });
  });

  it('says nothing at all when the deployment has recorded no clips', () => {
    expect(
      chooseBridge({
        context: CONTEXT,
        clips: [],
        picker: createBridgePicker({ seed: 1 }),
        turnIndex: 0,
      }),
    ).toEqual({ play: false, rule: 'no-clip' });
  });

  it('passes the skipping rule through so a deployment can see what silenced it', () => {
    expect(
      chooseBridge({
        context: { ...CONTEXT, childSpeaking: true },
        clips: CLIPS,
        picker: createBridgePicker({ seed: 1 }),
        turnIndex: 0,
      }),
    ).toEqual({ play: false, rule: 'child-speaking' });
  });

  it('cannot judge the answer', () => {
    expect(bridgeTextIsNonCommittal('Let me check.')).toBe(true);
    expect(bridgeTextIsNonCommittal('Yes, that is right.')).toBe(false);
  });
});
