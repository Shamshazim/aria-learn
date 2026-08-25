import { z } from 'zod';

export const voiceObservationSchema = z
  .object({
    scenarioId: z.string().min(1).max(128),
    provenance: z.enum(['human_labelled', 'synthetic']),
    transcriptCorrect: z.boolean(),
    endOfTurnCorrect: z.boolean(),
    interruptionSilenceMs: z.number().nonnegative().max(30_000).nullable(),
    firstAudioMs: z.number().nonnegative().max(60_000),
    endToEndMs: z.number().nonnegative().max(120_000),
    falseTeaching: z.boolean(),
    lowConfidenceDurableUpdate: z.boolean(),
    spokenTeachingApproved: z.boolean().nullable(),
    estimatedCostUsd: z.number().nonnegative().max(10),
  })
  .strict();

export const voiceCandidateResultSchema = z
  .object({
    candidate: z.string().min(1).max(128),
    generatedAt: z.iso.datetime(),
    observations: z.array(voiceObservationSchema).min(1).max(10_000),
  })
  .strict();

export type VoiceObservation = z.infer<typeof voiceObservationSchema>;
export type VoiceCandidateResult = z.infer<typeof voiceCandidateResultSchema>;
