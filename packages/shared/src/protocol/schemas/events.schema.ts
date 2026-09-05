import { z } from 'zod';

import { bandSchema, gradeSchema } from '../../band/band';

import { envelopeShape, sequenceSchema } from './common.schema';

/**
 * The seventeen events Aria receives (`master-plan.md` §4.1, P0-27 realtime signals, and the
 * child's `SKIP`).
 *
 * One schema per kind, then a discriminated union over `kind`. Discriminated rather than a
 * plain union so an unknown kind fails with a readable error naming the field, and so
 * narrowing on `event.kind` is exhaustive in the tutor loop.
 */

const MAX_TEXT = 2000;

/** The shape every event shares, mirroring `moveShape` so the two sides cannot drift. */
export const eventShape = {
  ...envelopeShape,
  /** The highest `serverSeq` the client has applied, so the server can replay after a drop. */
  acknowledgedSeq: sequenceSchema.optional(),
} as const;

/** Every event schema starts from the same envelope; only the payload differs. */
function event<K extends string, T extends z.ZodRawShape>(kind: K, payload: T) {
  return z.object({ ...eventShape, kind: z.literal(kind), ...payload });
}

/** The student home became active. No session yet — this is what creates one. */
export const arrivedEventSchema = event('ARRIVED', {
  band: bandSchema.optional(),
  grade: gradeSchema.optional(),
});

/** The child picked a class, or accepted Aria's recommendation. */
export const subjectChosenEventSchema = event('SUBJECT_CHOSEN', {
  subjectId: z.string().min(1).max(64),
  grade: gradeSchema,
  /** True when this came from accepting a `RECOMMEND`, which is worth knowing in the log. */
  fromRecommendation: z.boolean().default(false),
});

/**
 * A tap, drag, typed answer or final spoken answer.
 *
 * `choiceId` and `text` are both optional and at least one is required, because the same
 * event covers a tapped option and a typed number. `refine` enforces that rather than
 * splitting one concept into two event kinds the tutor loop would have to handle twice.
 */
export const answerEventSchema = event('ANSWER', {
  respondsTo: z.string().min(1).max(128),
  choiceId: z.string().min(1).max(64).optional(),
  text: z.string().min(1).max(MAX_TEXT).optional(),
  /** Milliseconds from the move being shown to the answer arriving; evidence, not a score. */
  elapsedMs: z.number().int().nonnegative().max(3_600_000).optional(),
}).refine((e) => e.choiceId !== undefined || e.text !== undefined, {
  message: 'An ANSWER needs a choiceId or text',
  path: ['choiceId'],
});

/** The child asks Aria something. */
export const questionEventSchema = event('QUESTION', {
  text: z.string().min(1).max(MAX_TEXT),
});

/** "I don't get it", or an equivalent signal. */
export const confusedEventSchema = event('CONFUSED', {
  aboutMoveId: z.string().min(1).max(128).optional(),
});

/**
 * The child wants a different question, or has stopped engaging with this one.
 *
 * A human tutor does not re-ask the same question a fourth time. `reason` says who decided:
 * the child ("skip", "next one", "I give up"), or Aria, who watched them disengage. Either
 * way the open item is closed with its answer shown and a fresh one follows.
 */
export const SKIP_REASONS = ['child_asked', 'not_engaging', 'too_hard', 'too_easy'] as const;

export const skipEventSchema = event('SKIP', {
  /** The question being skipped, when the client knows which one it is showing. */
  respondsTo: z.string().min(1).max(128).optional(),
  reason: z.enum(SKIP_REASONS).default('child_asked'),
});

/** Live transcription while the child talks. Partials are advisory and may be revised. */
export const speechPartialEventSchema = event('SPEECH_PARTIAL', {
  text: z.string().max(MAX_TEXT),
  confidence: z.number().min(0).max(1).optional(),
});

export const speechFinalEventSchema = event('SPEECH_FINAL', {
  text: z.string().min(1).max(MAX_TEXT),
  confidence: z.number().min(0).max(1).optional(),
  alternatives: z
    .array(
      z
        .object({
          text: z.string().min(1).max(MAX_TEXT),
          confidence: z.number().min(0).max(1),
        })
        .strict(),
    )
    .max(5)
    .optional(),
});

/** No response inside the age-appropriate window. The window is a policy, not a protocol value. */
export const silenceEventSchema = event('SILENCE', {
  waitedMs: z.number().int().nonnegative().max(3_600_000),
  afterMoveId: z.string().min(1).max(128).optional(),
});

/** The child started talking while Aria was speaking. Phase 2 stops her within 250ms. */
export const interruptEventSchema = event('INTERRUPT', {
  interruptedMoveId: z.string().min(1).max(128).optional(),
});

/** A child sound during Aria's speech that did not become an interruption. */
export const backchannelEventSchema = event('BACKCHANNEL', {});

/** Client-side VAD onset. Advisory until the server confirms an interruption. */
export const speechStartedEventSchema = event('SPEECH_STARTED', {});

/** Media connectivity changed while the logical session remained alive. */
export const mediaLostEventSchema = event('MEDIA_LOST', {});
export const mediaRestoredEventSchema = event('MEDIA_RESTORED', {});

export const pauseEventSchema = event('PAUSE', {});
export const resumeEventSchema = event('RESUME', {});

/** The child left. `reason` separates a deliberate exit from a dropped connection. */
export const leaveEventSchema = event('LEAVE', {
  reason: z.enum(['done', 'navigated_away', 'disconnected']).default('navigated_away'),
});

export const tutorInputEventSchema = z.discriminatedUnion('kind', [
  arrivedEventSchema,
  subjectChosenEventSchema,
  answerEventSchema,
  questionEventSchema,
  confusedEventSchema,
  skipEventSchema,
  speechPartialEventSchema,
  speechFinalEventSchema,
  silenceEventSchema,
  interruptEventSchema,
  backchannelEventSchema,
  speechStartedEventSchema,
  mediaLostEventSchema,
  mediaRestoredEventSchema,
  pauseEventSchema,
  resumeEventSchema,
  leaveEventSchema,
]);

export type TutorInputEvent = z.infer<typeof tutorInputEventSchema>;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const EVENT_KINDS = [
  'ARRIVED',
  'SUBJECT_CHOSEN',
  'ANSWER',
  'QUESTION',
  'CONFUSED',
  'SKIP',
  'SPEECH_PARTIAL',
  'SPEECH_FINAL',
  'SILENCE',
  'INTERRUPT',
  'BACKCHANNEL',
  'SPEECH_STARTED',
  'MEDIA_LOST',
  'MEDIA_RESTORED',
  'PAUSE',
  'RESUME',
  'LEAVE',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];
