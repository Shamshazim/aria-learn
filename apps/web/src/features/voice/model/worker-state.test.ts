import { describe, expect, it, vi } from 'vitest';

import type { VoiceWorkerState } from '@aria/shared';

import { INITIAL_VOICE_STATE, type VoiceState } from '@/features/voice/model/voice-state';
import { applyWorkerState } from '@/features/voice/model/worker-state';

import type { Room } from 'livekit-client';

function apply(state: VoiceWorkerState, enabled = true): VoiceState {
  return applyAll([state], enabled).state;
}

function applyAll(
  states: readonly VoiceWorkerState[],
  enabled = true,
): { state: VoiceState; agentStates: string[] } {
  let current = INITIAL_VOICE_STATE;
  const agentStates: string[] = [];
  const room = {
    localParticipant: { isMicrophoneEnabled: true, publishData: () => Promise.resolve() },
    state: 'connected',
  } as unknown as Room;
  for (const state of states) {
    applyWorkerState(room, state, {
      enabled,
      acknowledgedSeq: () => 0,
      acknowledgeDelivered: vi.fn(),
      onAgentState: (agentState) => {
        agentStates.push(agentState);
      },
      setState: (update) => {
        current = typeof update === 'function' ? update(current) : update;
      },
    });
  }
  return { state: current, agentStates };
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

  it('builds a transcript of the current turn and starts over when she speaks again', () => {
    const turn = applyAll([
      { kind: 'AGENT_STATE', state: 'speaking' },
      { kind: 'CAPTION', text: 'Nice.' },
      { kind: 'CAPTION', text: 'You counted the tens first.' },
    ]);
    expect(turn.state).toMatchObject({
      speaking: true,
      caption: 'You counted the tens first.',
      transcript: 'Nice. You counted the tens first.',
    });
    expect(turn.agentStates).toEqual(['speaking']);

    const next = applyAll([
      { kind: 'AGENT_STATE', state: 'speaking' },
      { kind: 'CAPTION', text: 'Nice.' },
      { kind: 'AGENT_STATE', state: 'listening' },
      { kind: 'AGENT_STATE', state: 'speaking' },
      { kind: 'CAPTION', text: 'Now try this one.' },
    ]);
    expect(next.state.transcript).toBe('Now try this one.');
    expect(next.agentStates).toEqual(['speaking', 'listening', 'speaking']);
  });

  it('treats the pipeline voice finishing playback as Aria going quiet', () => {
    const done = applyAll([{ kind: 'SPEECH_FINISHED', acknowledgedSeq: 4 }]);
    expect(done.state.speaking).toBe(false);
    expect(done.agentStates).toEqual(['listening']);
  });
});
