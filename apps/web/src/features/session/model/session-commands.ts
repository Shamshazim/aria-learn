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
  completeDrag(moveId: string): Promise<void>;
  interrupt(): Promise<void>;
  leave(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  speak(): Promise<void>;
  receive(move: TutorMove): void;
}>;

type Send = (payload: EventPayload) => Promise<void>;

export function createSessionCommands(
  input: Readonly<{
    state: SessionState;
    connectionStatus: ConnectionStatus;
    send: Send;
    interrupt(): Promise<void>;
    receive(move: TutorMove): void;
    silence: SilenceControls;
    speak?: () => Promise<void>;
  }>,
): TutorSession {
  const { state, connectionStatus, send, interrupt, receive, silence, speak } = input;
  return {
    state,
    connectionStatus,
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
  };
}
