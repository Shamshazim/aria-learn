import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { Grade, TutorMove } from '@aria/shared';

import { useSilenceTimer, type SilenceControls } from '@/features/session/hooks/useSilenceTimer';
import { ONLINE, reduceConnection } from '@/features/session/model/connection-state';
import { createEventFactory, type EventPayload } from '@/features/session/model/input-events';
import {
  createSessionCommands,
  type TutorSession,
} from '@/features/session/model/session-commands';
import { reduceSession } from '@/features/session/model/session-machine';
import { initialSessionState, type SessionState } from '@/features/session/model/session-state';
import { ContentUnavailableError, type TutorSource } from '@/features/session/model/tutor-source';

export type { TutorSession } from '@/features/session/model/session-commands';

export function useTutorSession(input: {
  band: SessionState['band'];
  grade: Grade;
  subjectId: string;
  createSource: () => TutorSource;
  startupEvents?: readonly EventPayload[];
  onSpeak?: () => Promise<void>;
  onMove?: (move: TutorMove) => void;
}): TutorSession {
  const [state, dispatch] = useReducer(reduceSession, input.band, initialSessionState);
  const [connection, dispatchConnection] = useReducer(reduceConnection, ONLINE);
  const source = useRef<TutorSource | null>(null);
  const active = useRef<AbortController | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  const onMove = useRef(input.onMove);
  stateRef.current = state;
  onMove.current = input.onMove;
  const events = useEventFactory();
  const transport = useSend(
    { source, active, queue, events, onMove },
    { session: dispatch, connection: dispatchConnection },
  );
  const send = transport.send;

  useSourceLifecycle(input, source, active, send);
  useMediaEvents(send, transport.retry);
  const silence = useSilence(state, send);

  const interrupt = useCallback(async (): Promise<void> => {
    const interruptedMoveId = stateRef.current.currentMove?.id;
    active.current?.abort();
    dispatch({ kind: 'STOP_ACTIVE' });
    await send({
      kind: 'INTERRUPT',
      ...(interruptedMoveId === undefined ? {} : { interruptedMoveId }),
    });
  }, [send]);

  const receive = useCallback((move: Parameters<typeof dispatch>[0]): void => {
    dispatch(move);
  }, []);
  return createSessionCommands({
    state,
    connectionStatus: connection.status,
    send,
    interrupt,
    receive,
    silence,
    ...(input.onSpeak === undefined ? {} : { speak: input.onSpeak }),
  });
}

type Send = (payload: EventPayload) => Promise<void>;

function useSilence(state: SessionState, send: Send): SilenceControls {
  return useSilenceTimer({
    move: state.currentMove,
    band: state.band,
    speaking: state.status === 'speaking',
    onSilence: useCallback(
      (payload: Readonly<{ waitedMs: number; afterMoveId: string }>) => {
        void send({ kind: 'SILENCE', ...payload });
      },
      [send],
    ),
  });
}
type Transport = Readonly<{ send: Send; retry(): Promise<void> }>;
type Retry = Readonly<{ payload: EventPayload; source: TutorSource }>;
type SourceRefs = Readonly<{
  source: React.RefObject<TutorSource | null>;
  active: React.RefObject<AbortController | null>;
  queue: React.RefObject<Promise<void>>;
  events: React.RefObject<ReturnType<typeof createEventFactory>>;
  onMove: React.RefObject<((move: TutorMove) => void) | undefined>;
}>;
type SendDispatch = Readonly<{
  session: React.Dispatch<Parameters<typeof reduceSession>[1]>;
  connection: React.Dispatch<Parameters<typeof reduceConnection>[1]>;
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

function useSend(refs: SourceRefs, dispatchers: SendDispatch): Transport {
  const retryRef = useRef<Retry | null>(null);
  const send = useCallback(
    (payload: EventPayload): Promise<void> => enqueue(refs, dispatchers, retryRef, payload),
    [
      refs.active,
      refs.events,
      refs.queue,
      refs.source,
      dispatchers.connection,
      dispatchers.session,
    ],
  );
  const retry = useCallback(async (): Promise<void> => {
    const retryable = retryRef.current;
    if (retryable === null) return;
    if (refs.source.current !== retryable.source) {
      retryRef.current = null;
      return;
    }
    await send(retryable.payload);
  }, [refs.source, send]);
  return { send, retry };
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
      operation.refs.onMove.current?.(move);
      operation.dispatchers.session(move);
    }
    recoverConnection(operation);
  } catch (error) {
    failed = true;
    if (!(error instanceof ContentUnavailableError)) throw error;
    retryRef.current = { payload: operation.payload, source: operation.source };
    operation.dispatchers.connection({ kind: 'CONTENT_EXHAUSTED' });
  } finally {
    if (activeRef.current === controller) activeRef.current = null;
    settleEmptyOperation(operation, { controller, emitted, failed });
  }
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

function useSourceLifecycle(
  input: Parameters<typeof useTutorSession>[0],
  source: React.RefObject<TutorSource | null>,
  active: React.RefObject<AbortController | null>,
  send: Send,
): void {
  const createSource = input.createSource;
  const sourceRef = source;
  useEffect(() => {
    const currentSource = createSource();
    const lifecycle = new AbortController();
    sourceRef.current = currentSource;
    void playStartup(input, send, lifecycle.signal);
    return () => {
      lifecycle.abort();
      active.current?.abort();
      currentSource.close();
      if (sourceRef.current === currentSource) sourceRef.current = null;
    };
  }, [active, createSource, input.grade, input.startupEvents, input.subjectId, send, sourceRef]);
}

async function playStartup(
  input: Parameters<typeof useTutorSession>[0],
  send: Send,
  signal: AbortSignal,
): Promise<void> {
  if (input.startupEvents !== undefined) {
    for (const event of input.startupEvents) {
      if (signal.aborted) return;
      await send(event);
    }
    return;
  }
  await send({ kind: 'ARRIVED', grade: input.grade });
  if (signal.aborted) return;
  await send({
    kind: 'SUBJECT_CHOSEN',
    subjectId: input.subjectId,
    grade: input.grade,
    fromRecommendation: false,
  });
}

function useMediaEvents(send: Send, retry: () => Promise<void>): void {
  useEffect(() => {
    const lost = (): void => {
      void send({ kind: 'MEDIA_LOST' });
    };
    const restored = (): void => {
      void send({ kind: 'MEDIA_RESTORED' }).then(retry);
    };
    window.addEventListener('offline', lost);
    window.addEventListener('online', restored);
    return () => {
      window.removeEventListener('offline', lost);
      window.removeEventListener('online', restored);
    };
  }, [retry, send]);
}
