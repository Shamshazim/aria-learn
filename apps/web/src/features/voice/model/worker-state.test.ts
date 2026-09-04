import { describe, expect, it, vi } from 'vitest';

import type { VoiceWorkerState } from '@aria/shared';

import { INITIAL_VOICE_STATE, type VoiceState } from '@/features/voice/model/voice-state';
import { applyWorkerState } from '@/features/voice/model/worker-state';

import type { Room } from 'livekit-client';

function apply(state: VoiceWorkerState, enabled = true): VoiceState {
  let current = INITIAL_VOICE_STATE;
  const room = {
    localParticipant: { isMicrophoneEnabled: true, publishData: () => Promise.resolve() },
    state: 'connected',
  } as unknown as Room;
  applyWorkerState(room, state, {
    enabled,
    acknowledgedSeq: () => 0,
    acknowledgeDelivered: vi.fn(),
    setState: (update) => {
      current = typeof update === 'function' ? update(current) : update;
    },
  });
  return current;
}

describe('what the worker tells the screen', () => {
  it('remembers that this voice talks, so the screen answers through it', () => {
    expect(apply({ kind: 'WORKER_READY', talks: true })).toMatchObject({
      talks: true,
      status: 'listening',
    });
    expect(apply({ kind: 'WORKER_READY', talks: false }, false)).toMatchObject({
      talks: false,
      status: 'ready',
    });
  });

  it("shows Aria's own sentence as the caption, and what she heard as the child's line", () => {
    expect(apply({ kind: 'CAPTION', text: 'Nice, you counted the tens first.' }).caption).toBe(
      'Nice, you counted the tens first.',
    );
    expect(apply({ kind: 'HEARD', text: 'four hundred seventy' }).heard).toBe(
      'four hundred seventy',
    );
  });
});
