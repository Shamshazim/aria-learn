import {
  PROTOCOL_VERSION,
  type TutorInputEvent,
  type TutorMove,
  type VoiceTurnResponse,
} from '@aria/shared';
import { decideInterruption, spokenForm } from '@aria/voice';

import type { TutorVoiceClient } from '@/api/tutor-client';
import type { VoiceRoomContext } from '@/session/session-context';

export type MovePublisher = Readonly<{ publish(move: TutorMove): Promise<void> }>;

type MoveStreamInput = Readonly<{
  room: VoiceRoomContext;
  client: Pick<TutorVoiceClient, 'turn'>;
  publisher: MovePublisher;
  nextId(): string;
  now(): Date;
}>;

type MoveStreamState = Readonly<{
  acknowledgedSeq(): number;
  acknowledge(serverSeq: number): void;
  deliveredSeq(): number;
  markDelivered(serverSeq: number): void;
  activeGenerationId(): string | null;
  activate(generationId: string | null): void;
  terminalSpeechPending(): boolean;
  terminalDelivered(): boolean;
  markTerminalSpeechPending(pending: boolean): void;
  pendingPlaybackSeq(): number;
  markPendingPlayback(serverSeq: number): void;
  takePendingPlaybackSeq(): number;
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
  handleTranscript(text: string, confidence?: number, signal?: AbortSignal): AsyncIterable<string>;
  resume(signal?: AbortSignal): AsyncIterable<string>;
  speechStarted(): AsyncIterable<string>;
  acceptAcknowledgement(serverSeq: number): void;
  acknowledgedSeq(): number;
  activeGenerationId(): string | null;
  terminalSpeechPending(): boolean;
  terminalDelivered(): boolean;
  takePendingPlaybackSeq(): number;
  clearGeneration(): void;
}>;

export function createMoveStream(input: MoveStreamInput): MoveStream {
  const state = createMoveStreamState();
  const serialize = createStreamSerializer();
  return {
    handleTranscript: (text, confidence, signal) =>
      serialize(() =>
        send(input, state, {
          event: transcriptEvent(input, state, text, confidence),
          replayOnly: false,
          ...(signal === undefined ? {} : { signal }),
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
  };
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

async function* send(
  input: MoveStreamInput,
  state: MoveStreamState,
  request: Readonly<{ event: TutorInputEvent; replayOnly: boolean; signal?: AbortSignal }>,
): AsyncIterable<string> {
  const response = await requestTurn(input, state, request);
  if (response.connectionEpoch !== input.room.connectionEpoch) {
    throw new Error('Tutor API returned a stale voice connection epoch');
  }
  for (const move of response.moves) {
    if (move.serverSeq !== undefined && move.serverSeq <= state.deliveredSeq()) continue;
    const speech = await applyMove(input.publisher, state, move);
    if (speech !== null) yield speech;
  }
}

function requestTurn(
  input: MoveStreamInput,
  state: MoveStreamState,
  request: Readonly<{ event: TutorInputEvent; replayOnly: boolean; signal?: AbortSignal }>,
): Promise<VoiceTurnResponse> {
  return input.client.turn(
    input.room.sessionId,
    {
      protocolVersion: PROTOCOL_VERSION,
      event: request.event,
      replayOnly: request.replayOnly,
      acknowledgedSeq: state.acknowledgedSeq(),
      connectionEpoch: input.room.connectionEpoch,
    },
    request.signal,
  );
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

function createMoveStreamState(): MoveStreamState {
  let acknowledgedSeq = 0;
  let deliveredSeq = 0;
  let activeGenerationId: string | null = null;
  let terminalSpeechPending = false;
  let terminalDelivered = false;
  let pendingPlaybackSeq = 0;
  return {
    acknowledgedSeq: () => acknowledgedSeq,
    acknowledge: (serverSeq) => {
      acknowledgedSeq = Math.max(acknowledgedSeq, serverSeq);
    },
    deliveredSeq: () => deliveredSeq,
    markDelivered: (serverSeq) => {
      deliveredSeq = Math.max(deliveredSeq, serverSeq);
    },
    activeGenerationId: () => activeGenerationId,
    activate: (generationId) => {
      activeGenerationId = generationId;
    },
    terminalSpeechPending: () => terminalSpeechPending,
    terminalDelivered: () => terminalDelivered,
    markTerminalSpeechPending: (pending) => {
      terminalDelivered = true;
      terminalSpeechPending = pending;
    },
    pendingPlaybackSeq: () => pendingPlaybackSeq,
    markPendingPlayback: (serverSeq) => {
      pendingPlaybackSeq = Math.max(pendingPlaybackSeq, serverSeq);
    },
    takePendingPlaybackSeq: () => {
      const result = pendingPlaybackSeq;
      pendingPlaybackSeq = 0;
      return result;
    },
  };
}
