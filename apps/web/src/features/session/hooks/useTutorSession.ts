import { useCallback, useReducer, useRef, useState } from 'react';

import type { Grade, TutorMove } from '@aria/shared';

import { useMediaEvents, useSourceLifecycle } from '@/features/session/hooks/useSessionLifecycle';
import { useSilenceTimer, type SilenceControls } from '@/features/session/hooks/useSilenceTimer';
import { ONLINE, reduceConnection } from '@/features/session/model/connection-state';
import { createEventFactory, type EventPayload } from '@/features/session/model/input-events';
import {
  createSessionCommands,
  type TutorSession,
} from '@/features/session/model/session-commands';
import { reduceSession } from '@/features/session/model/session-machine';
import { initialSessionState, type SessionState } from '@/features/session/model/session-state';
import {
  ContentUnavailableError,
  TurnRejectedError,
  type TutorSource,
} from '@/features/session/model/tutor-source';

export type { TutorSession } from '@/features/session/model/session-commands';

export function useTutorSession(input: {
  band: SessionState['band'];
  grade: Grade;
  subjectId: string;
  createSource: () => TutorSource;
  startupEvents?: readonly EventPayload[];
  onSpeak?: () => Promise<void>;
  onMove?: (move: TutorMove) => void;
  /**
   * A voice worker is connected. It owns the silence countdown and says when Aria has
   * finished speaking; without one, a move is "explained" the moment it is on screen.
   */
  voiceLive?: boolean;
}): TutorSession {
  const [state, dispatch] = useReducer(reduceSession, input.band, initialSessionState);
  const [connection, dispatchConnection] = useReducer(reduceConnection, ONLINE);
  const source = useRef<TutorSource | null>(null);
  const active = useRef<AbortController | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  const onMove = useRef(input.onMove);
  const voiceLive = useRef(input.voiceLive === true);
  stateRef.current = state;
  onMove.current = input.onMove;
  voiceLive.current = input.voiceLive === true;
  const events = useEventFactory();
  const transport = useSend(
    { source, active, queue, events, onMove, voiceLive },
    { session: dispatch, connection: dispatchConnection },
  );
  const send = transport.send;

  useSourceLifecycle(input, source, active, send);
  useMediaEvents(send, transport.retry);
  const silence = useSilence(state, send, input.voiceLive === true);

  const interrupt = useCallback(async (): Promise<void> => {
    const interruptedMoveId = stateRef.current.currentMove?.id;
    active.current?.abort();
    dispatch({ kind: 'STOP_ACTIVE' });
    await send({
      kind: 'INTERRUPT',
      ...(interruptedMoveId === undefined ? {} : { interruptedMoveId }),
    });
  }, [send]);

  return createSessionCommands({
    state,
    connectionStatus: connection.status,
    send,
    interrupt,
    ...useDispatchers(dispatch),
    silence,
    retryFailed: transport.retryFailed,
    ...(input.onSpeak === undefined ? {} : { speak: input.onSpeak }),
  });
}

type Send = (payload: EventPayload) => Promise<void>;

/** The two ways something other than the source reaches the reducer: a move, or the voice. */
function useDispatchers(
  dispatch: React.Dispatch<Parameters<typeof reduceSession>[1]>,
): Pick<TutorSession, 'receive' | 'voiceState'> {
  const receive = useCallback(
    (move: TutorMove): void => {
      dispatch(move);
    },
    [dispatch],
  );
  const voiceState = useCallback(
    (voice: 'listening' | 'thinking' | 'speaking'): void => {
      dispatch({ kind: 'VOICE_STATE', state: voice });
    },
    [dispatch],
  );
  return { receive, voiceState };
}

function useSilence(state: SessionState, send: Send, suspended: boolean): SilenceControls {
  return useSilenceTimer({
    move: state.currentMove,
    band: state.band,
    speaking: state.status === 'speaking',
    suspended,
    onSilence: useCallback(
      (payload: Readonly<{ waitedMs: number; afterMoveId: string }>) => {
        void send({ kind: 'SILENCE', ...payload });
      },
      [send],
    ),
  });
}
type Transport = Readonly<{
  send: Send;
  retry(): Promise<void>;
  retryFailed: (() => Promise<void>) | null;
}>;
type Retry = Readonly<{ payload: EventPayload; source: TutorSource }>;
type SourceRefs = Readonly<{
  source: React.RefObject<TutorSource | null>;
  active: React.RefObject<AbortController | null>;
  queue: React.RefObject<Promise<void>>;
  events: React.RefObject<ReturnType<typeof createEventFactory>>;
  onMove: React.RefObject<((move: TutorMove) => void) | undefined>;
  voiceLive: React.RefObject<boolean>;
}>;
type SendDispatch = Readonly<{
  session: React.Dispatch<Parameters<typeof reduceSession>[1]>;
  connection: React.Dispatch<Parameters<typeof reduceConnection>[1]>;
  failed: React.Dispatch<React.SetStateAction<Retry | null>>;
}>;

function useEventFactory(): React.RefObject<ReturnType<typeof createEventFactory>> {
  const counter = useRef(0);
  return useRef(
    createEventFactory({
      nextId: () => `web-event-${String(++counter.current)}`,
      now: () => new Date(),
    }),
  );
}

function useSend(refs: SourceRefs, dispatch: Omit<SendDispatch, 'failed'>): Transport {
  const retryRef = useRef<Retry | null>(null);
  // An input the API refused, kept in state so the notice and its button can render.
  const [failed, setFailed] = useState<Retry | null>(null);
  const send = useCallback(
    (payload: EventPayload): Promise<void> =>
      enqueue(refs, { ...dispatch, failed: setFailed }, retryRef, payload),
    [
      refs.active,
      refs.events,
      refs.queue,
      refs.source,
      refs.voiceLive,
      dispatch.connection,
      dispatch.session,
    ],
  );
  const retryFailed = useMemoRetryFailed(failed, refs.source, send, setFailed);
  const retry = useCallback(async (): Promise<void> => {
    const retryable = retryRef.current;
    if (retryable === null) return;
    if (refs.source.current !== retryable.source) {
      retryRef.current = null;
      return;
    }
    await send(retryable.payload);
  }, [refs.source, send]);
  return { send, retry, retryFailed };
}

function useMemoRetryFailed(
  failed: Retry | null,
  source: React.RefObject<TutorSource | null>,
  send: Send,
  setFailed: React.Dispatch<React.SetStateAction<Retry | null>>,
): (() => Promise<void>) | null {
  const retry = useCallback(async (): Promise<void> => {
    if (failed === null) return;
    setFailed(null);
    if (source.current !== failed.source) return;
    await send(failed.payload);
  }, [failed, send, setFailed, source]);
  return failed === null ? null : retry;
}

function enqueue(
  refs: SourceRefs,
  dispatchers: SendDispatch,
  retryRef: React.RefObject<Retry | null>,
  payload: EventPayload,
): Promise<void> {
  const requestedSource = refs.source.current;
  if (requestedSource === null) return Promise.resolve();
  const queueRef = refs.queue;
  const operation = queueRef.current.then(() =>
    runSourceOperation({ refs, dispatchers, retryRef, payload, source: requestedSource }),
  );
  queueRef.current = operation.catch(() => undefined);
  return operation;
}

type SourceOperation = Readonly<{
  refs: SourceRefs;
  dispatchers: SendDispatch;
  retryRef: React.RefObject<Retry | null>;
  payload: EventPayload;
  source: TutorSource;
}>;

async function runSourceOperation(operation: SourceOperation): Promise<void> {
  const sourceRef = operation.refs.source;
  if (sourceRef.current !== operation.source) return;
  operation.dispatchers.session({ kind: 'SOURCE_PENDING' });
  const controller = new AbortController();
  const activeRef = operation.refs.active;
  const retryRef = operation.retryRef;
  activeRef.current = controller;
  let emitted = false;
  let failed = false;
  try {
    for await (const move of operation.source.send(
      operation.refs.events.current(operation.payload),
      controller.signal,
    )) {
      if (sourceRef.current !== operation.source || controller.signal.aborted) return;
      emitted = true;
      // P2H-07: a segment is a sentence on its way to the screen, not a move to act on.
      if (move.kind !== 'MOVE_SEGMENT') operation.refs.onMove.current?.(move);
      operation.dispatchers.session(move);
    }
    settleSpeech(operation, emitted);
    recoverConnection(operation);
    operation.dispatchers.failed(null);
  } catch (error) {
    failed = true;
    if (error instanceof ContentUnavailableError) {
      retryRef.current = { payload: operation.payload, source: operation.source };
      operation.dispatchers.connection({ kind: 'CONTENT_EXHAUSTED' });
      // The notice says why; the status line must stop saying "thinking".
      if (operation.refs.source.current === operation.source) {
        operation.dispatchers.session({ kind: 'SOURCE_SETTLED' });
      }
    } else {
      reportRejection(operation, error);
    }
  } finally {
    if (activeRef.current === controller) activeRef.current = null;
    settleEmptyOperation(operation, { controller, emitted, failed });
  }
}

/**
 * The turn was refused, or something broke that no retry-later sentence describes. It used to
 * be rethrown into a `void` promise — the child tapped, nothing happened, and the silence
 * ladder started nagging. Now it is shown, and the status line stops saying "thinking".
 */
function reportRejection(operation: SourceOperation, error: unknown): void {
  const code = error instanceof TurnRejectedError ? error.code : 'UNEXPECTED';
  // The one console line in the app: a swallowed rejection is how this bug went unnoticed.
  // eslint-disable-next-line no-console -- the browser console is the only sink the web has.
  console.error(`[session] a turn was not delivered (${code})`, error);
  if (operation.refs.source.current !== operation.source) return;
  operation.dispatchers.failed({ payload: operation.payload, source: operation.source });
  operation.dispatchers.session({ kind: 'SOURCE_SETTLED' });
}

/** With no voice to play the moves there is nothing to wait for: they are "explained" now. */
function settleSpeech(operation: SourceOperation, emitted: boolean): void {
  if (!emitted || operation.refs.voiceLive.current) return;
  operation.dispatchers.session({ kind: 'SPEECH_SETTLED' });
}

function recoverConnection(operation: SourceOperation): void {
  const retryRef = operation.retryRef;
  if (retryRef.current?.source !== operation.source) return;
  if (retryRef.current.payload !== operation.payload) return;
  retryRef.current = null;
  operation.dispatchers.connection({ kind: 'CONNECTION_RESTORED' });
}

function settleEmptyOperation(
  operation: SourceOperation,
  outcome: Readonly<{ controller: AbortController; emitted: boolean; failed: boolean }>,
): void {
  if (outcome.failed || outcome.emitted || outcome.controller.signal.aborted) return;
  if (operation.refs.source.current !== operation.source) return;
  operation.dispatchers.session({ kind: 'SOURCE_SETTLED' });
}
