import type { TutorMove } from '@aria/shared';

import type { SilenceControls } from '@/features/session/hooks/useSilenceTimer';
import type { ConnectionStatus } from '@/features/session/model/connection-state';
import {
  completedDragEvent,
  questionEvent,
  SCRIPTED_SPEECH_EVENTS,
  SESSION_ENDED_EVENT,
  type EventPayload,
} from '@/features/session/model/input-events';
import type { SessionState } from '@/features/session/model/session-state';

export type TutorSession = Readonly<{
  state: SessionState;
  connectionStatus: ConnectionStatus;
  answer(moveId: string, value: string): Promise<void>;
  askQuestion(text?: string): Promise<void>;
  backchannel(): Promise<void>;
  /** A partial transcript: the child is mid-sentence, so the silence window restarts. */
  speechPartial(text: string): Promise<void>;
  confused(): Promise<void>;
  /** The child is done with the open question: its answer is shown and a fresh one follows. */
  skip(): Promise<void>;
  completeDrag(moveId: string): Promise<void>;
  interrupt(): Promise<void>;
  leave(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  speak(): Promise<void>;
  receive(move: TutorMove): void;
  /** What the voice is doing, so the status line says the same thing. */
  voiceState(state: 'listening' | 'thinking' | 'speaking'): void;
  /** Sends the last input Aria never received again; `null` while there is nothing to resend. */
  retryFailed: (() => Promise<void>) | null;
}>;

type Send = (payload: EventPayload) => Promise<void>;

export function createSessionCommands(
  input: Readonly<{
    state: SessionState;
    connectionStatus: ConnectionStatus;
    send: Send;
    interrupt(): Promise<void>;
    receive(move: TutorMove): void;
    voiceState(state: 'listening' | 'thinking' | 'speaking'): void;
    silence: SilenceControls;
    speak?: () => Promise<void>;
    retryFailed: (() => Promise<void>) | null;
  }>,
): TutorSession {
  const { state, connectionStatus, send, interrupt, receive, voiceState, silence, speak } = input;
  return {
    state,
    connectionStatus,
    retryFailed: input.retryFailed,
    answer: (moveId, value) => send({ kind: 'ANSWER', respondsTo: moveId, text: value }),
    askQuestion: (text) => send(questionEvent(text)),
    backchannel: () => {
      // A sound that says "still here" stops the nudge without counting as an answer.
      silence.backchannel();
      return send({ kind: 'BACKCHANNEL' });
    },
    speechPartial: (text) => {
      silence.speechPartial();
      return send({ kind: 'SPEECH_PARTIAL', text });
    },
    confused: () =>
      send({
        kind: 'CONFUSED',
        ...(state.currentMove === null ? {} : { aboutMoveId: state.currentMove.id }),
      }),
    skip: () =>
      send({
        kind: 'SKIP',
        reason: 'child_asked',
        ...(state.openQuestion === null ? {} : { respondsTo: state.openQuestion.id }),
      }),
    completeDrag: (moveId) => send(completedDragEvent(moveId)),
    interrupt,
    leave: () => send(SESSION_ENDED_EVENT),
    pause: () => send({ kind: 'PAUSE' }),
    resume: () => send({ kind: 'RESUME' }),
    speak:
      speak ??
      (async () => {
        for (const event of SCRIPTED_SPEECH_EVENTS) {
          // A partial transcript means the child is mid-sentence: give them the window back.
          if (event.kind === 'SPEECH_PARTIAL') silence.speechPartial();
          await send(event);
        }
      }),
    receive,
    voiceState,
  };
}
