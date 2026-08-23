/**
 * The events Aria receives.
 *
 * Every type here is `z.infer` of its schema, so a type and its validator can never drift:
 * there is exactly one description of an event, and it is the one that also parses untrusted
 * input (CODE-STANDARDS §1).
 */
export {
  tutorInputEventSchema,
  arrivedEventSchema,
  subjectChosenEventSchema,
  answerEventSchema,
  questionEventSchema,
  confusedEventSchema,
  speechPartialEventSchema,
  speechFinalEventSchema,
  silenceEventSchema,
  interruptEventSchema,
  pauseEventSchema,
  resumeEventSchema,
  leaveEventSchema,
  EVENT_KINDS,
} from './schemas/events.schema';

export type { TutorInputEvent, EventKind } from './schemas/events.schema';
