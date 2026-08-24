import { z } from 'zod';

import {
  envelopeShape,
  expectsSchema,
  messageIdSchema,
  sequenceSchema,
  speechSchema,
} from '../common.schema';
import { displaySchema } from '../content.schema';

const reflexesSchema = z
  .object({
    duckOnSpeech: z.boolean(),
  })
  .strict();

/**
 * The shape every move shares, in one place so the four kind groups cannot drift apart.
 *
 * `speech` is present on every move (`null` when there is nothing to say) so Phase 2 can
 * speak any move without a protocol change, and `expects` is what the UI reads to choose an
 * input control — never the move kind.
 */
export const moveShape = {
  ...envelopeShape,
  speech: speechSchema,
  display: displaySchema,
  expects: expectsSchema,
  serverSeq: sequenceSchema.optional(),
  causationId: messageIdSchema.optional(),
  resumeOf: messageIdSchema.optional(),
  generationId: messageIdSchema.optional(),
  reflexes: reflexesSchema.optional(),
} as const;

export function move<K extends string, T extends z.ZodRawShape>(
  kind: K,
  payload: T,
): z.ZodObject<typeof moveShape & { kind: z.ZodLiteral<K> } & T> {
  return z.object({ ...moveShape, kind: z.literal(kind), ...payload });
}

/** Bounds shared across move payloads; a hostile or broken payload stays allocation-safe (§8). */
export const MAX_REASON = 500;
export const MAX_REF = 128;
