import {
  PROTOCOL_VERSION,
  tutorInputEventSchema,
  type Grade,
  type TutorInputEvent,
} from '@aria/shared';

export type EventPayload =
  | Readonly<{ kind: 'ARRIVED'; grade: Grade }>
  | Readonly<{
      kind: 'SUBJECT_CHOSEN';
      subjectId: string;
      grade: Grade;
      fromRecommendation: boolean;
    }>
  | Readonly<{ kind: 'ANSWER'; respondsTo: string; text: string }>
  | Readonly<{ kind: 'QUESTION'; text: string }>
  | Readonly<{ kind: 'CONFUSED'; aboutMoveId?: string }>
  | Readonly<{ kind: 'SPEECH_PARTIAL'; text: string }>
  | Readonly<{ kind: 'SPEECH_FINAL'; text: string }>
  | Readonly<{ kind: 'SILENCE'; waitedMs: number; afterMoveId?: string }>
  | Readonly<{ kind: 'INTERRUPT'; interruptedMoveId?: string }>
  | Readonly<{ kind: 'BACKCHANNEL' }>
  | Readonly<{ kind: 'SPEECH_STARTED' }>
  | Readonly<{ kind: 'MEDIA_LOST' }>
  | Readonly<{ kind: 'MEDIA_RESTORED' }>
  | Readonly<{ kind: 'PAUSE' }>
  | Readonly<{ kind: 'RESUME' }>
  | Readonly<{ kind: 'LEAVE'; reason: 'done' | 'navigated_away' | 'disconnected' }>;

export type EventFactory = (payload: EventPayload) => TutorInputEvent;

export function createEventFactory(dependencies: { nextId(): string; now(): Date }): EventFactory {
  return (payload) =>
    tutorInputEventSchema.parse({
      id: dependencies.nextId(),
      at: dependencies.now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      ...payload,
    });
}
