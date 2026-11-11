import { Room } from 'livekit-client';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { AgentState, TutorMove } from '@aria/shared';
import { createMoveInbox } from '@aria/voice';

import type { SessionApi } from '@/features/session/api/session.api';
import { useLeaveOnEnd, useScreenBridge } from '@/features/voice/hooks/useScreenBridge';
import { useVoiceActions, type VoiceActions } from '@/features/voice/hooks/useVoiceActions';
import { bindRoom } from '@/features/voice/model/room-bindings';
import {
  INITIAL_VOICE_STATE,
  type VoiceState,
  withVoiceDevices,
} from '@/features/voice/model/voice-state';
import { createVoiceTimings, type VoiceTimings } from '@/features/voice/model/voice-timings';
import { microphones, readAcknowledgedSeq } from '@/features/voice/model/voice-transport';
import type { TurnTimingReporter } from '@/lib/observability/timing';

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
  /** X-04: the two §11 bars only this tab can see. Absent in a scripted session. */
  timings?: TurnTimingReporter;
}>;

export function useRealtimeVoice(input: RealtimeVoiceInput): RealtimeVoice {
  const [state, setState] = useState(INITIAL_VOICE_STATE);
  const refs = useVoiceRefs();
  const onAgentState = useRef(input.onAgentState);
  onAgentState.current = input.onAgentState;
  const timings = useMemo(() => createVoiceTimings(input.timings), [input.timings]);

  useVoiceConnection({ input, refs, setState, timings, onAgentState });
  const actions = useVoiceActions({
    room: refs.room,
    generation: refs.generation,
    enabled: refs.enabled,
    acknowledgedSeq: refs.acknowledgedSeq,
    vad: refs.vad,
    setState,
    ...(input.timings === undefined ? {} : { timings: input.timings }),
  });
  useAutoEnableVoice(input, state.status, actions.enable, refs.autoEnableAttempt);
  useLeaveOnEnd(input.ended === true, refs);
  const bridge = useScreenBridge(refs, input.renderedMoves);
  return { ...state, ...actions, ...bridge };
}

/**
 * Everything about the voice that survives a render.
 *
 * Refs rather than state because none of it belongs on screen: the room, the generation being
 * spoken, the acknowledgement cursor and the VAD's cleanup are read by event handlers that
 * were registered once, and a re-render for any of them would reconnect the room.
 */
type VoiceRefs = Readonly<{
  room: React.RefObject<Room | null>;
  generation: React.RefObject<string | null>;
  enabled: React.RefObject<boolean>;
  connectionEpoch: React.RefObject<number | null>;
  acknowledgedSeq: React.RefObject<number>;
  talks: React.RefObject<boolean>;
  autoEnableAttempt: React.RefObject<string | null>;
  vad: Readonly<{ current(): (() => void) | null; set(cleanup: (() => void) | null): void }>;
}>;

function useVoiceRefs(): VoiceRefs {
  const room = useRef<Room | null>(null);
  const vadCleanup = useRef<(() => void) | null>(null);
  const generation = useRef<string | null>(null);
  const enabled = useRef(false);
  const connectionEpoch = useRef<number | null>(null);
  const acknowledgedSeq = useRef(0);
  const talks = useRef(false);
  const autoEnableAttempt = useRef<string | null>(null);
  // The VAD's teardown outlives every room: a microphone left analysing after the session is a
  // microphone still running, so it is stopped on unmount and nowhere else.
  useEffect(() => () => vadCleanup.current?.(), []);
  return useMemo(
    () => ({
      room,
      generation,
      enabled,
      connectionEpoch,
      acknowledgedSeq,
      talks,
      autoEnableAttempt,
      vad: {
        current: () => vadCleanup.current,
        set: (cleanup: (() => void) | null) => {
          vadCleanup.current = cleanup;
        },
      },
    }),
    [],
  );
}

/** One room per session, torn down when the session id changes or the page goes away. */
function useVoiceConnection(
  args: Readonly<{
    input: RealtimeVoiceInput;
    refs: VoiceRefs;
    setState: React.Dispatch<React.SetStateAction<VoiceState>>;
    timings: VoiceTimings;
    onAgentState: React.RefObject<RealtimeVoiceInput['onAgentState']>;
  }>,
): void {
  const { input, refs, setState, timings, onAgentState } = args;
  const onMove = input.onMove;
  useEffect(
    () =>
      connect({
        enabled: refs.enabled,
        connectionEpoch: refs.connectionEpoch,
        acknowledgedSeq: refs.acknowledgedSeq,
        talks: refs.talks,
        sessionId: input.sessionId,
        api: input.api,
        setState,
        timings,
        onMove,
        onAgentState: (state) => {
          timings.agentState(state);
          onAgentState.current?.(state);
        },
        setRoom: (room) => {
          refs.room.current = room;
        },
        setGenerationId: (generationId) => {
          refs.generation.current = generationId;
        },
        renderedMoves: input.renderedMoves,
      }),
    [
      input.api,
      input.renderedMoves,
      input.sessionId,
      onAgentState,
      onMove,
      refs,
      setState,
      timings,
    ],
  );
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
  timings: VoiceTimings;
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
  input.timings.bind(input.sessionId);
  bindRoom(room, { ...input, sessionId: input.sessionId, inbox });
  void negotiateAndConnect(input, room, controller.signal);
  return () => {
    controller.abort();
    input.timings.disconnected();
    input.timings.bind(null);
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
    // X-04: sound is now possible. `audio_unlocked` runs from here to the browser actually
    // permitting it, which is one tap for a child and nothing at all where autoplay is allowed.
    input.timings.roomConnected();
    const devices = await microphones();
    input.setState((current) => withVoiceDevices(current, devices));
  } catch {
    input.setState((current) => ({ ...current, status: 'unavailable' }));
  }
}
