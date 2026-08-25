import { z } from 'zod';

import {
  envelopeShape,
  expectsSchema,
  messageIdSchema,
  sequenceSchema,
  speechSchema,
} from '../common.schema';
import { displaySchema } from '../content.schema';

/**
 * The shape every move shares, in one place so the four kind groups cannot drift apart.
 *
 * `speech` is present on every move (`null` when there is nothing to say) so Phase 2 can
 * speak any move without a protocol change, and `expects` is what the UI reads to choose an
 * input control — never the move kind.
 */

/**
 * What the client may do on its own when the child starts talking.
 *
 * `.strict()` is the rule, not tidiness: the only reflex a client gets is to duck the audio.
 * Stopping is a server decision (it confirms the interruption by `generationId`), so a
 * `stopOnSpeech` flag must fail to parse rather than be silently ignored.
 */
const reflexesSchema = z
  .object({
    duckOnSpeech: z.boolean(),
  })
  .strict();

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
  return z
    .object({ ...moveShape, kind: z.literal(kind), ...payload })
    .refine((parsed) => hasSpeechForGeneration(parsed), {
      message: 'generationId identifies audio, so it needs speech',
      path: ['generationId'],
    });
}

/** `generationId` names a piece of audio, so a move that says nothing cannot carry one. */
function hasSpeechForGeneration(parsed: object): boolean {
  const { generationId, speech } = parsed as { generationId?: unknown; speech: unknown };
  return generationId === undefined || speech !== null;
}

/** Bounds shared across move payloads; a hostile or broken payload stays allocation-safe (§8). */
export const MAX_REASON = 500;
export const MAX_REF = 128;
