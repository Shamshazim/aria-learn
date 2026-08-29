import { z } from 'zod';

import { bandSchema, gradeSchema } from '../band/band';

import { messageIdSchema, sequenceSchema } from './schemas/common.schema';

/**
 * The voice channel where Aria talks (Phase 2H, "Aria talks").
 *
 * A realtime speech model is Aria's voice and her conversational mind; the API stays the
 * curriculum, the grader, the memory and the safety layer. These three shapes are what the
 * two exchange besides the turn itself: the brief the model teaches from, the words the child
 * said (so the transcript and the crisis check are complete), and the words Aria said (so the
 * transcript is complete and unsafe speech is caught).
 */
const shortText = z.string().min(1).max(500);

export const voiceBriefSchema = z.object({
  connectionEpoch: sequenceSchema,
  student: z.object({
    /** Only when the parent allowed the first name to be shared with a model (P2H-12). */
    firstName: z.string().min(1).max(64).nullable(),
    grade: gradeSchema,
    band: bandSchema,
  }),
  subject: z.string().min(1).max(64),
  skill: z
    .object({
      code: z.string().min(1).max(64),
      name: shortText,
      unit: shortText.nullable(),
      lesson: shortText.nullable(),
      objectives: z.array(shortText).max(16),
    })
    .nullable(),
  /** P2H-10: the teacher's note where the skill has one; most catalogue topics do not yet. */
  note: z
    .object({
      whatItIs: z.string().max(1_000),
      oneIdea: z.string().max(1_000),
      stumbles: z.array(z.string().max(500)).max(8),
      models: z.array(z.string().max(1_000)).max(4),
      workedExample: z.string().max(2_000),
      useLanguage: z.array(z.string().max(200)).max(16),
      avoidLanguage: z.array(z.string().max(200)).max(16),
    })
    .nullable(),
  openQuestion: z
    .object({
      id: messageIdSchema,
      prompt: z.string().min(1).max(2_000),
      /** The key stays server-side for the browser; the tutor's own voice needs it. */
      answerKey: z.string().max(500).nullable(),
      options: z.array(z.object({ id: z.string().min(1).max(64), text: shortText })).max(6),
    })
    .nullable(),
  /** What Aria remembers about this child, already scrubbed for a model. */
  memory: z.array(z.string().max(500)).max(24),
  minutesLeft: z.number().int().min(0).max(240),
});

export const voiceHeardRequestSchema = z.object({
  connectionEpoch: sequenceSchema,
  text: z.string().min(1).max(2_000),
});

export const voiceHeardResponseSchema = z.object({
  /** The fixed crisis response Aria must say, verbatim, instead of anything else. */
  crisis: z.object({ say: z.string().min(1).max(2_000) }).nullable(),
});

export const voiceSpokenRequestSchema = z.object({
  connectionEpoch: sequenceSchema,
  text: z.string().min(1).max(4_000),
});

export const voiceSpokenResponseSchema = z.object({
  verdict: z.enum(['ok', 'unsafe']),
});

export type VoiceBrief = z.infer<typeof voiceBriefSchema>;
export type VoiceHeardRequest = z.infer<typeof voiceHeardRequestSchema>;
export type VoiceHeardResponse = z.infer<typeof voiceHeardResponseSchema>;
export type VoiceSpokenRequest = z.infer<typeof voiceSpokenRequestSchema>;
export type VoiceSpokenResponse = z.infer<typeof voiceSpokenResponseSchema>;
