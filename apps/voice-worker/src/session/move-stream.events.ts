import { PROTOCOL_VERSION, type TutorInputEvent, type VoiceTurnRequest } from '@aria/shared';
import { decideInterruption } from '@aria/voice';

import type { MoveStreamState } from '@/session/move-stream.state';
import type { VoiceRoomContext } from '@/session/session-context';

/**
 * What the worker sends the control plane, and nothing about what comes back.
 *
 * Every event carries the same envelope — the room it belongs to, the epoch it was minted
 * for, and how far the child has acknowledged — so a stale connection is rejected by the API
 * rather than being noticed later.
 */
export type EventInput = Readonly<{
  room: VoiceRoomContext;
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

export function turnRequest(
  input: EventInput,
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

export function transcriptEvent(
  input: EventInput,
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

/** P2H-15: a spoken answer the speech-to-speech model handed to `check_answer`. */
export function answerEvent(
  input: EventInput,
  state: MoveStreamState,
  respondsTo: string,
  text: string,
): TutorInputEvent {
  return { ...commonEvent(input, state), kind: 'ANSWER', respondsTo, text };
}

export function resumeEvent(input: EventInput, state: MoveStreamState): TutorInputEvent {
  return { ...commonEvent(input, state), kind: 'RESUME' };
}

export function commonEvent(input: EventInput, state: MoveStreamState): CommonVoiceEvent {
  return {
    id: input.nextId(),
    at: input.now().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sessionId: input.room.sessionId,
    connectionEpoch: input.room.connectionEpoch,
    acknowledgedSeq: state.acknowledgedSeq(),
  };
}
