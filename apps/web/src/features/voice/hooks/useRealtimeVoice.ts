import { Room, RoomEvent, Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

import type { AgentState, TutorMove } from '@aria/shared';
import { createMoveInbox } from '@aria/voice';

import type { SessionApi } from '@/features/session/api/session.api';
import { useLeaveOnEnd, useScreenBridge } from '@/features/voice/hooks/useScreenBridge';
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
  readAcknowledgedSeq,
  storeAcknowledgedSeq,
} from '@/features/voice/model/voice-transport';
import { applyWorkerState, statusWhenReady } from '@/features/voice/model/worker-state';

export type RealtimeVoice = VoiceState &
  VoiceActions &
  Readonly<{
    syncMove(move: TutorMove): Promise<void>;
    /**
     * "Aria talks": an answer given on the screen goes to the voice, not the API, so Aria
     * reacts to it out loud. Returns false when there is no talking voice to give it to, and
     * the caller sends it the usual way.
     */
    answerOnScreen(moveId: string, text: string): Promise<boolean>;
    /** The same for a skip: the voice closes the question and asks the next one out loud. */
    skipOnScreen(moveId: string): Promise<boolean>;
  }>;

type RealtimeVoiceInput = Readonly<{
  sessionId: string | null;
  /** The session is over on the screen, so a talking voice is told to say goodbye. */
  ended?: boolean;
  autoEnable?: boolean;
  api: SessionApi;
  renderedMoves: Set<string>;
  onMove(move: TutorMove): void;
  /** Aria started or stopped talking, so the session's status line can follow her. */
  onAgentState?(state: AgentState): void;
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
  const talks = useRef(false);
  const onMove = input.onMove;
  const onAgentState = useRef(input.onAgentState);
  onAgentState.current = input.onAgentState;
  useEffect(
    () =>
      connect({
        sessionId: input.sessionId,
        api: input.api,
        setState,
        onMove,
        onAgentState: (state) => onAgentState.current?.(state),
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
        talks,
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
  useLeaveOnEnd(input.ended === true, { room: roomRef, enabled: enabledRef, talks });
  const bridge = useScreenBridge(
    { room: roomRef, enabled: enabledRef, talks },
    input.renderedMoves,
  );
  return { ...state, ...actions, ...bridge };
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
  onAgentState(state: AgentState): void;
  setRoom(room: Room | null): void;
  setGenerationId(generationId: string | null): void;
  renderedMoves: Set<string>;
  enabled: React.RefObject<boolean>;
  connectionEpoch: React.RefObject<number | null>;
  acknowledgedSeq: React.RefObject<number>;
  talks: React.RefObject<boolean>;
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
  onAgentState(state: AgentState): void;
  setGenerationId(generationId: string | null): void;
  renderedMoves: Set<string>;
  enabled: React.RefObject<boolean>;
  connectionEpoch: React.RefObject<number | null>;
  acknowledgedSeq: React.RefObject<number>;
  talks: React.RefObject<boolean>;
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
