import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TutorMove } from '@aria/shared';
import { createMoveInbox } from '@aria/voice';

import type { SessionApi } from '@/features/session/api/session.api';
import { useVoiceActions, type VoiceActions } from '@/features/voice/hooks/useVoiceActions';
import { setRemoteVolume } from '@/features/voice/model/voice-audio';
import { parseVoiceMove, parseVoiceWorkerState } from '@/features/voice/model/voice-messages';
import {
  INITIAL_VOICE_STATE,
  type VoiceState,
  withVoiceDevices,
} from '@/features/voice/model/voice-state';
import {
  microphones,
  publishAcknowledgement,
  publishClientEvent,
  readAcknowledgedSeq,
  storeAcknowledgedSeq,
} from '@/features/voice/model/voice-transport';
import { workerReadyAcknowledgement } from '@/features/voice/model/worker-ready';

export type RealtimeVoice = VoiceState &
  VoiceActions &
  Readonly<{
    syncMove(move: TutorMove): Promise<void>;
  }>;

type RealtimeVoiceInput = Readonly<{
  sessionId: string | null;
  autoEnable?: boolean;
  api: SessionApi;
  renderedMoves: Set<string>;
  onMove(move: TutorMove): void;
}>;

export function useRealtimeVoice(input: RealtimeVoiceInput): RealtimeVoice {
  const [state, setState] = useState(INITIAL_VOICE_STATE);
  const roomRef = useRef<Room | null>(null);
  const vadCleanup = useRef<(() => void) | null>(null);
  const generationRef = useRef<string | null>(null);
  const enabledRef = useRef(false);
  const autoEnableAttempt = useRef<string | null>(null);
  const connectionEpoch = useRef<number | null>(null);
  const acknowledgedSeq = useRef(0);
  const onMove = input.onMove;
  useEffect(
    () =>
      connect({
        sessionId: input.sessionId,
        api: input.api,
        setState,
        onMove,
        setRoom: (room) => {
          roomRef.current = room;
        },
        setGenerationId: (generationId) => {
          generationRef.current = generationId;
        },
        renderedMoves: input.renderedMoves,
        enabled: enabledRef,
        connectionEpoch,
        acknowledgedSeq,
      }),
    [input.api, input.sessionId, onMove],
  );
  useEffect(() => () => vadCleanup.current?.(), []);
  const actions = useVoiceActions({
    room: roomRef,
    generation: generationRef,
    enabled: enabledRef,
    acknowledgedSeq,
    vad: {
      current: () => vadCleanup.current,
      set: (cleanup) => {
        vadCleanup.current = cleanup;
      },
    },
    setState,
  });
  useAutoEnableVoice(input, state.status, actions.enable, autoEnableAttempt);
  const syncMove = useCallback(
    async (move: TutorMove) => {
      input.renderedMoves.add(move.id);
      const room = roomRef.current;
      if (enabledRef.current && room?.state === ConnectionState.Connected) {
        await publishClientEvent(room, { kind: 'SYNC' });
      }
    },
    [input.renderedMoves],
  );
  return { ...state, ...actions, syncMove };
}

function useAutoEnableVoice(
  input: Readonly<{ autoEnable?: boolean; sessionId: string | null }>,
  status: VoiceState['status'],
  enable: () => Promise<void>,
  attempt: React.RefObject<string | null>,
): void {
  const attemptRef = attempt;
  useEffect(() => {
    if (!input.autoEnable || input.sessionId === null || status !== 'ready') return;
    if (attemptRef.current === input.sessionId) return;
    attemptRef.current = input.sessionId;
    void enable();
  }, [attemptRef, enable, input.autoEnable, input.sessionId, status]);
}

type VoiceConnectionDeps = Readonly<{
  sessionId: string | null;
  api: SessionApi;
  setState: React.Dispatch<React.SetStateAction<VoiceState>>;
  onMove(move: TutorMove): void;
  setRoom(room: Room | null): void;
  setGenerationId(generationId: string | null): void;
  renderedMoves: Set<string>;
  enabled: React.RefObject<boolean>;
  connectionEpoch: React.RefObject<number | null>;
  acknowledgedSeq: React.RefObject<number>;
}>;

function connect(input: VoiceConnectionDeps): (() => void) | undefined {
  if (input.sessionId === null) return undefined;
  const enabled = input.enabled;
  const connectionEpoch = input.connectionEpoch;
  const acknowledgedSeq = input.acknowledgedSeq;
  const room = new Room({ adaptiveStream: true, dynacast: true });
  const initialAcknowledgedSeq = readAcknowledgedSeq(input.sessionId);
  acknowledgedSeq.current = initialAcknowledgedSeq;
  const inbox = createMoveInbox(initialAcknowledgedSeq);
  const controller = new AbortController();
  input.setGenerationId(null);
  input.setRoom(room);
  bindRoom(room, { ...input, sessionId: input.sessionId, inbox });
  void negotiateAndConnect(input, room, controller.signal);
  return () => {
    controller.abort();
    enabled.current = false;
    input.setRoom(null);
    input.setGenerationId(null);
    connectionEpoch.current = null;
    acknowledgedSeq.current = 0;
    void room.disconnect();
  };
}

async function negotiateAndConnect(
  input: VoiceConnectionDeps,
  room: Room,
  signal: AbortSignal,
): Promise<void> {
  const connectionEpoch = input.connectionEpoch;
  let credentials;
  try {
    credentials = await input.api.realtime(input.sessionId ?? '', signal);
    connectionEpoch.current = credentials.connectionEpoch;
  } catch {
    input.setState((current) => ({ ...current, status: 'needs-consent' }));
    return;
  }
  try {
    input.setState((current) => ({ ...current, status: 'connecting' }));
    await room.connect(credentials.url, credentials.token);
    const devices = await microphones();
    input.setState((current) => withVoiceDevices(current, devices));
  } catch {
    input.setState((current) => ({ ...current, status: 'unavailable' }));
  }
}

type RoomBindings = Readonly<{
  inbox: ReturnType<typeof createMoveInbox>;
  setState: React.Dispatch<React.SetStateAction<VoiceState>>;
  onMove(move: TutorMove): void;
  setGenerationId(generationId: string | null): void;
  renderedMoves: Set<string>;
  enabled: React.RefObject<boolean>;
  connectionEpoch: React.RefObject<number | null>;
  acknowledgedSeq: React.RefObject<number>;
  sessionId: string;
}>;

function bindRoom(room: Room, input: RoomBindings): void {
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) document.body.append(track.attach());
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
    input.setState((current) => ({ ...current, caption: parsed.speech?.text ?? '' }));
    if (!alreadyRendered) input.onMove(parsed);
    if (parsed.speech === null && parsed.serverSeq !== undefined) {
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
      status: !input.enabled.current
        ? 'ready'
        : room.localParticipant.isMicrophoneEnabled
          ? 'listening'
          : 'muted',
    }));
  });
  room.on(RoomEvent.Disconnected, () => {
    input.setState((current) => ({ ...current, status: 'unavailable' }));
  });
}

function applyVoiceState(room: Room, payload: Uint8Array, input: RoomBindings): void {
  const state = parseVoiceWorkerState(payload);
  if (state === null) return;
  if (state.kind === 'WORKER_READY') {
    const acknowledgement = workerReadyAcknowledgement(
      state,
      input.enabled.current,
      input.inbox.acknowledgedSeq(),
    );
    if (acknowledgement !== null) {
      void publishClientEvent(room, acknowledgement).catch(() => undefined);
    }
    input.setState((current) => ({
      ...current,
      status: !input.enabled.current
        ? 'ready'
        : room.localParticipant.isMicrophoneEnabled
          ? 'listening'
          : 'muted',
    }));
    return;
  }
  if (state.kind === 'METRICS_UNAVAILABLE') return;
  if (state.kind === 'SPEECH_FINISHED') {
    acknowledgeDelivered(room, input, state.acknowledgedSeq);
    return;
  }
  input.setState((current) => ({
    ...current,
    caption: "I didn't catch that. Please try again.",
    status: current.status === 'muted' ? 'muted' : 'listening',
  }));
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
