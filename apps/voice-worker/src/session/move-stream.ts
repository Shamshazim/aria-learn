import {
  PROTOCOL_VERSION,
  type TutorInputEvent,
  type TutorMove,
  type MoveSegment,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';
import { decideInterruption, spokenForm } from '@aria/voice';

import type { TutorVoiceClient } from '@/api/tutor-client';
import { createMoveStreamState, type MoveStreamState } from '@/session/move-stream.state';
import type { VoiceRoomContext } from '@/session/session-context';

export type MovePublisher = Readonly<{ publish(move: TutorMove): Promise<void> }>;

type MoveStreamInput = Readonly<{
  room: VoiceRoomContext;
  client: Pick<TutorVoiceClient, 'turn' | 'turnStream'>;
  publisher: MovePublisher;
  nextId(): string;
  now(): Date;
}>;

type CommonVoiceEvent = Readonly<{
  id: string;
  at: string;
  protocolVersion: typeof PROTOCOL_VERSION;
  sessionId: VoiceRoomContext['sessionId'];
  connectionEpoch: number;
  acknowledgedSeq: number;
}>;

export type MoveStream = Readonly<{
  authorize(signal?: AbortSignal): Promise<void>;
  handleTranscript(text: string, confidence?: number, signal?: AbortSignal): AsyncIterable<string>;
  /** P2H-01: the child said nothing inside the band window. */
  silence(payload: Readonly<{ waitedMs: number; afterMoveId: string }>): AsyncIterable<string>;
  resume(signal?: AbortSignal): AsyncIterable<string>;
  speechStarted(): AsyncIterable<string>;
  acceptAcknowledgement(serverSeq: number): void;
  acknowledgedSeq(): number;
  activeGenerationId(): string | null;
  terminalSpeechPending(): boolean;
  terminalDelivered(): boolean;
  takePendingPlaybackSeq(): number;
  clearGeneration(): void;
  /** P2H-07: the child talked over this generation; its late sentences are dropped. */
  cancelGeneration(generationId: string): void;
}>;

export function createMoveStream(input: MoveStreamInput): MoveStream {
  const state = createMoveStreamState();
  const serialize = createStreamSerializer();
  return {
    authorize: (signal) => authorize(input, state, signal),
    handleTranscript: (text, confidence, signal) =>
      serialize(() =>
        send(input, state, {
          event: transcriptEvent(input, state, text, confidence),
          replayOnly: false,
          ...(signal === undefined ? {} : { signal }),
        }),
      ),
    silence: (payload) =>
      serialize(() =>
        send(input, state, {
          event: { ...commonEvent(input, state), kind: 'SILENCE', ...payload },
          replayOnly: false,
        }),
      ),
    resume: (signal) =>
      serialize(() =>
        send(input, state, {
          event: resumeEvent(input, state),
          replayOnly: true,
          ...(signal === undefined ? {} : { signal }),
        }),
      ),
    speechStarted: () =>
      serialize(() =>
        observe(input, state, {
          event: { ...commonEvent(input, state), kind: 'SPEECH_STARTED' },
          replayOnly: true,
        }),
      ),
    acceptAcknowledgement: state.acknowledge,
    acknowledgedSeq: state.acknowledgedSeq,
    activeGenerationId: state.activeGenerationId,
    terminalSpeechPending: state.terminalSpeechPending,
    terminalDelivered: state.terminalDelivered,
    takePendingPlaybackSeq: state.takePendingPlaybackSeq,
    clearGeneration: () => {
      state.activate(null);
    },
    cancelGeneration: (generationId) => {
      // The child is talking over this answer, so the API is told to stop writing it: the
      // request is abandoned, which is what ends generation rather than merely muting it.
      state.order.cancel(generationId);
      state.abortGeneration();
      state.activate(null);
    },
  };
}

async function authorize(
  input: MoveStreamInput,
  state: MoveStreamState,
  signal?: AbortSignal,
): Promise<void> {
  const response = await requestTurn(input, state, {
    event: resumeEvent(input, state),
    replayOnly: true,
    authorizeOnly: true,
    ...(signal === undefined ? {} : { signal }),
  });
  if (response.connectionEpoch !== input.room.connectionEpoch) {
    throw new Error('Tutor API returned a stale voice connection epoch');
  }
}

async function* observe(
  input: MoveStreamInput,
  state: MoveStreamState,
  request: Readonly<{ event: TutorInputEvent; replayOnly: boolean }>,
): AsyncIterable<string> {
  const response = await requestTurn(input, state, request);
  if (response.connectionEpoch !== input.room.connectionEpoch)
    throw new Error('Tutor API returned a stale voice connection epoch');
  yield* [];
}

function createStreamSerializer(): (stream: () => AsyncIterable<string>) => AsyncIterable<string> {
  let tail = Promise.resolve();
  return (stream) => ({
    async *[Symbol.asyncIterator]() {
      const previous = tail;
      let release = (): void => undefined;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        yield* stream();
      } finally {
        release();
      }
    },
  });
}

/**
 * P2H-07: speaks Aria's sentences as they arrive, then publishes the moves they belonged to.
 *
 * A sentence is spoken the moment every sentence before it has been — the segment order decides
 * that, not the network. The closing frame carries the same moves the buffered response always
 * did; a move whose own sentences were already spoken is still published, so the transcript and
 * the outbox are complete, but it is not said twice.
 */
async function* send(
  input: MoveStreamInput,
  state: MoveStreamState,
  request: Readonly<{ event: TutorInputEvent; replayOnly: boolean; signal?: AbortSignal }>,
): AsyncIterable<string> {
  const generation = state.beginGeneration(request.signal);
  state.order.begin();
  try {
    const request$ = turnRequest(input, state, request);
    for await (const frame of input.client.turnStream(input.room.sessionId, request$, generation)) {
      yield* frame.kind === 'MOVE_SEGMENT'
        ? spokenSegments(state, frame)
        : closeTurn(input, state, frame.turn);
    }
  } catch (error) {
    // The child talked over the answer, so the request was pulled on purpose.
    if (!state.generationAborted()) throw error;
  }
}

/** The sentences this one unblocked, in the order they were written. */
function* spokenSegments(state: MoveStreamState, segment: MoveSegment): Generator<string> {
  state.activate(segment.generationId);
  for (const ready of state.order.accept(segment)) yield ready.speech;
}

/**
 * The closing frame: the moves the sentences belonged to.
 *
 * `settle` runs first because reaching here is what proves the stream said the whole of what it
 * wrote. Before that a partly-spoken move counts as unspoken, so replaying it whole is how a
 * child hears the rest of an answer the connection dropped.
 */
async function* closeTurn(
  input: MoveStreamInput,
  state: MoveStreamState,
  turn: VoiceTurnResponse,
): AsyncIterable<string> {
  if (turn.connectionEpoch !== input.room.connectionEpoch) {
    throw new Error('Tutor API returned a stale voice connection epoch');
  }
  state.order.settle();
  for (const move of turn.moves) {
    if (move.serverSeq !== undefined && move.serverSeq <= state.deliveredSeq()) continue;
    const speech = await applyMove(input.publisher, state, move);
    if (speech !== null) yield speech;
  }
}

function requestTurn(
  input: MoveStreamInput,
  state: MoveStreamState,
  request: Readonly<{
    event: TutorInputEvent;
    replayOnly: boolean;
    authorizeOnly?: boolean;
    signal?: AbortSignal;
  }>,
): Promise<VoiceTurnResponse> {
  return input.client.turn(
    input.room.sessionId,
    turnRequest(input, state, request),
    request.signal,
  );
}

function turnRequest(
  input: MoveStreamInput,
  state: MoveStreamState,
  request: Readonly<{ event: TutorInputEvent; replayOnly: boolean; authorizeOnly?: boolean }>,
): VoiceTurnRequest {
  // P2H-07: how far into an interrupted answer the child got, so the API can record it.
  const spokenPrefix = state.order.takeInterruptedPrefix();
  return {
    protocolVersion: PROTOCOL_VERSION,
    event: request.event,
    replayOnly: request.replayOnly,
    authorizeOnly: request.authorizeOnly ?? false,
    acknowledgedSeq: state.acknowledgedSeq(),
    connectionEpoch: input.room.connectionEpoch,
    ...(spokenPrefix === null ? {} : { spokenPrefix }),
  };
}

async function applyMove(
  publisher: MovePublisher,
  state: MoveStreamState,
  move: TutorMove,
): Promise<string | null> {
  await publisher.publish(move);
  if (move.serverSeq !== undefined) state.markDelivered(move.serverSeq);
  if (move.kind === 'END' || move.kind === 'BREAK') {
    state.markTerminalSpeechPending(move.speech !== null);
  }
  if (move.speech === null) return null;
  if (move.serverSeq !== undefined) state.markPendingPlayback(move.serverSeq);
  // P2H-07: the child already heard this one, a sentence at a time.
  if (state.order.wasSpoken(move.id)) return null;
  state.activate(move.generationId ?? null);
  return spokenForm(move.speech.text);
}

function transcriptEvent(
  input: MoveStreamInput,
  state: MoveStreamState,
  text: string,
  confidence?: number,
): TutorInputEvent {
  const generationId = state.activeGenerationId();
  if (
    generationId !== null &&
    decideInterruption({ generationId, speechDurationMs: 0, transcript: text }).kind ===
      'backchannel'
  ) {
    return { ...commonEvent(input, state), kind: 'BACKCHANNEL' };
  }
  return {
    ...commonEvent(input, state),
    kind: 'SPEECH_FINAL',
    text,
    ...(confidence === undefined ? {} : { confidence }),
  };
}

function resumeEvent(input: MoveStreamInput, state: MoveStreamState): TutorInputEvent {
  return { ...commonEvent(input, state), kind: 'RESUME' };
}

function commonEvent(input: MoveStreamInput, state: MoveStreamState): CommonVoiceEvent {
  return {
    id: input.nextId(),
    at: input.now().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sessionId: input.room.sessionId,
    connectionEpoch: input.room.connectionEpoch,
    acknowledgedSeq: state.acknowledgedSeq(),
  };
}
