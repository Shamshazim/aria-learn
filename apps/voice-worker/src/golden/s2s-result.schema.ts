import { z } from 'zod';

/**
 * P2H-15: one turn, as measured on either arm.
 *
 * The pipeline and the speech-to-speech prototype are compared on the same shape so that a
 * column in `voice-s2s-decision.md` means the same thing in both rows. Fields the pipeline
 * cannot exhibit (`offPlan`, `safetyEscapeWords`, `transcriptLagMs`) are still present and
 * read `false`, `0` and `null` there, because a missing column is not a zero.
 */
const boundedMs = z.number().nonnegative().max(120_000);

export const S2S_ARMS = ['pipeline', 's2s'] as const;
export type S2SArm = (typeof S2S_ARMS)[number];

export const s2sObservationSchema = z
  .object({
    turnId: z.string().min(1).max(128),
    /** Bars from `master-plan.md` §11: first audio after activation, and silence to reply. */
    firstAudioMs: boundedMs,
    silenceToReplyMs: boundedMs,
    interruptionToSilenceMs: boundedMs.nullable(),
    /** Backchannels and overlaps the model produced while the child was still talking. */
    overlapCount: z.number().int().nonnegative().max(1_000),
    /** The model voiced content the planner did not return. */
    offPlan: z.boolean(),
    /** Words the child heard before the safety tap cut an off-plan generation. */
    safetyEscapeWords: z.number().int().nonnegative().max(10_000),
    /** How far the vendor's output transcript trailed its audio; `null` when not measured. */
    transcriptLagMs: boundedMs.nullable(),
    sttError: z.boolean(),
    endOfTurnError: z.boolean(),
    /** P4-04 needs word timings, so oral reading is never on the S2S arm; reported, not hidden. */
    oralReading: z.boolean(),
    estimatedCostUsd: z.number().nonnegative().max(10),
    /** The P2H-14 rubric score for the session this turn belongs to, once a human scored it. */
    rubricScore: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const s2sArmResultSchema = z
  .object({
    arm: z.enum(S2S_ARMS),
    provider: z.string().min(1).max(128),
    generatedAt: z.iso.datetime(),
    observations: z.array(s2sObservationSchema).min(1).max(10_000),
  })
  .strict();

export type S2SObservation = z.infer<typeof s2sObservationSchema>;
export type S2SArmResult = z.infer<typeof s2sArmResultSchema>;
