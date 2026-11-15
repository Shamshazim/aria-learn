import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import type { HumanEvidence } from '@aria/tutor';

const at = z.iso.datetime();
const childId = z.string().min(1).max(64);

/**
 * The human observation file (`dev-docs/phase3-observations.json`, P3-08 protocol). Child ids
 * only — a name in this file is refused, not stored.
 */
export const humanEvidenceSchema = z.strictObject({
  welcomeConfirmations: z
    .array(z.strictObject({ childId, welcomeWasTrue: z.boolean(), recordedAt: at }))
    .default([]),
  briefReviews: z
    .array(
      z.strictObject({
        briefId: z.string().min(1).max(64),
        unsupportedClaims: z.number().int().min(0),
        recordedAt: at,
      }),
    )
    .default([]),
  corrections: z
    .array(z.strictObject({ childId, reflectedNextSession: z.boolean(), recordedAt: at }))
    .default([]),
  checkInRatings: z
    .array(
      z.strictObject({
        transcriptId: z.string().min(1).max(64),
        warmAndAppropriate: z.boolean(),
        recordedAt: at,
      }),
    )
    .default([]),
  protocolChildren: z
    .array(
      z.strictObject({
        childId,
        band: z.enum(['early', 'middle', 'senior']),
        weeksOfUse: z.number().min(0),
        recordedAt: at,
      }),
    )
    .default([]),
});

export const NO_HUMAN_EVIDENCE: HumanEvidence = {
  welcomeConfirmations: [],
  briefReviews: [],
  corrections: [],
  checkInRatings: [],
  protocolChildren: [],
};

/** No file yet means no observations yet — every human criterion then reads as missing. */
export async function readObservations(file: string): Promise<HumanEvidence> {
  const text = await readFile(file, 'utf8').catch(() => null);
  return text === null ? NO_HUMAN_EVIDENCE : humanEvidenceSchema.parse(JSON.parse(text));
}
