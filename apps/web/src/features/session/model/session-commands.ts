import type { TutorMove } from '@aria/shared';

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
    speak?: () => Promise<void>;
  }>,
): TutorSession {
  const { state, connectionStatus, send, interrupt, receive, speak } = input;
  return {
    state,
    connectionStatus,
    answer: (moveId, value) => send({ kind: 'ANSWER', respondsTo: moveId, text: value }),
    askQuestion: (text) => send(questionEvent(text)),
    backchannel: () => send({ kind: 'BACKCHANNEL' }),
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
        for (const event of SCRIPTED_SPEECH_EVENTS) await send(event);
      }),
    receive,
  };
}
