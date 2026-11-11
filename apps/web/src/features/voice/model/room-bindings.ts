import { RoomEvent, Track } from 'livekit-client';

import type { AgentState, TutorMove } from '@aria/shared';
import type { createMoveInbox } from '@aria/voice';

import { setRemoteVolume } from '@/features/voice/model/voice-audio';
import { parseVoiceMove, parseVoiceWorkerState } from '@/features/voice/model/voice-messages';
import type { VoiceState } from '@/features/voice/model/voice-state';
import type { VoiceTimings } from '@/features/voice/model/voice-timings';
import {
  publishAcknowledgement,
  storeAcknowledgedSeq,
} from '@/features/voice/model/voice-transport';
import { applyWorkerState, statusWhenReady } from '@/features/voice/model/worker-state';

import type { Room } from 'livekit-client';

/**
 * Every room event the voice reacts to, in one place.
 *
 * Split out of `useRealtimeVoice` because it is not hook logic: none of it touches React
 * beyond a setter it is handed, and all of it is the voice protocol — which move has already
 * been delivered, which epoch it belongs to, what an acknowledgement means, and what the
 * screen should say while the transport is recovering. The hook owns the lifecycle; this owns
 * what arrives on the wire (CODE-STANDARDS §3.2).
 */

export type RoomBindings = Readonly<{
  inbox: ReturnType<typeof createMoveInbox>;
  setState: React.Dispatch<React.SetStateAction<VoiceState>>;
  timings: VoiceTimings;
  onMove(move: TutorMove): void;
  onAgentState(state: AgentState): void;
  setGenerationId(generationId: string | null): void;
  renderedMoves: Set<string>;
  enabled: React.RefObject<boolean>;
  connectionEpoch: React.RefObject<number | null>;
  acknowledgedSeq: React.RefObject<number>;
  talks: React.RefObject<boolean>;
  sessionId: string;
}>;

export function bindRoom(room: Room, input: RoomBindings): void {
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== Track.Kind.Audio) return;
    const element = track.attach();
    document.body.append(element);
    input.timings.watchAudioElement(element);
  });
  room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    if (topic === 'aria.voice-state') {
      applyVoiceState(room, payload, input);
      return;
    }
    if (topic !== 'aria.moves') return;
    const parsed = parseVoiceMove(payload);
    if (parsed === null) return;
    if (parsed.connectionEpoch !== input.connectionEpoch.current) return;
    const delivered = input.inbox.receive(parsed);
    if (delivered.duplicate) return;
    const alreadyRendered = input.renderedMoves.has(parsed.id);
    input.renderedMoves.add(parsed.id);
    input.setGenerationId(parsed.generationId ?? null);
    setRemoteVolume(room, 1);
    // Where Aria talks, the caption is her own sentence, not the move's line.
    if (!input.talks.current) {
      input.setState((current) => ({ ...current, caption: parsed.speech?.text ?? '' }));
    }
    if (!alreadyRendered) input.onMove(parsed);
    // A silent move is delivered once it is on screen; so is every move where Aria talks,
    // because a realtime model says it in its own words rather than playing it back.
    if (parsed.serverSeq !== undefined && (parsed.speech === null || input.talks.current)) {
      acknowledgeDelivered(room, input, parsed.serverSeq);
    }
  });
  room.on(RoomEvent.ParticipantConnected, () => {
    if (input.enabled.current) acknowledge(room, input.inbox.acknowledgedSeq());
  });
  room.on(RoomEvent.Reconnecting, () => {
    input.setState((current) => ({ ...current, status: 'recovering' }));
  });
  room.on(RoomEvent.Reconnected, () => {
    if (input.enabled.current) acknowledge(room, input.inbox.acknowledgedSeq());
    input.setState((current) => ({
      ...current,
      status: statusWhenReady(room, input.enabled.current),
    }));
  });
  room.on(RoomEvent.Disconnected, () => {
    input.timings.disconnected();
    input.setState((current) => ({ ...current, status: 'unavailable' }));
  });
}

function applyVoiceState(room: Room, payload: Uint8Array, input: RoomBindings): void {
  const state = parseVoiceWorkerState(payload);
  if (state === null) return;
  if (state.kind === 'WORKER_READY') {
    const talks = input.talks;
    talks.current = state.talks;
  }
  applyWorkerState(room, state, {
    enabled: input.enabled.current,
    acknowledgedSeq: input.inbox.acknowledgedSeq,
    setState: input.setState,
    acknowledgeDelivered: (serverSeq) => {
      acknowledgeDelivered(room, input, serverSeq);
    },
    onAgentState: input.onAgentState,
  });
}

function acknowledgeDelivered(room: Room, input: RoomBindings, serverSeq: number): void {
  input.inbox.acknowledge(serverSeq);
  const acknowledgedSeq = input.acknowledgedSeq;
  acknowledgedSeq.current = input.inbox.acknowledgedSeq();
  storeAcknowledgedSeq(input.sessionId, input.inbox.acknowledgedSeq());
  acknowledge(room, input.inbox.acknowledgedSeq());
}

function acknowledge(room: Room, acknowledgedSeq: number): void {
  void publishAcknowledgement(room, acknowledgedSeq).catch(() => undefined);
}
