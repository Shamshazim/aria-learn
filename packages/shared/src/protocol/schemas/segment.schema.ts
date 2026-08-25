import { z } from 'zod';

import { messageIdSchema, sequenceSchema } from './common.schema';

/**
 * P2H-07: one gated sentence, on its way to a child's ears before the rest exists.
 *
 * A move used to arrive whole, which meant the child heard nothing until the last token was
 * generated. A segment is the smallest thing that is safe to say: it has passed the quality
 * gate on its own, and it is numbered, so the worker speaks them in the order they were
 * written and drops the ones that arrive after a barge-in.
 */
export const moveSegmentSchema = z.object({
  kind: z.literal('MOVE_SEGMENT'),
  /** The generation this sentence belongs to. Cancelling a generation drops all of them. */
  generationId: messageIdSchema,
  /** The move this sentence ends up inside, so a late duplicate can be recognised. */
  moveId: messageIdSchema,
  index: sequenceSchema,
  /** What a caption shows. */
  text: z.string().min(1).max(2_000),
  /** What the voice says: the same sentence with numerals and symbols spoken out. */
  speech: z.string().min(1).max(2_000),
  /**
   * Known-final. Whole-item kinds set it on their single segment, and a sentence stream sets
   * it on the remainder it flushes. A stream that ends exactly on a sentence boundary sets it
   * on nothing, so the closing frame — never a segment — is what ends a turn.
   */
  isLast: z.boolean(),
});

export type MoveSegment = z.infer<typeof moveSegmentSchema>;
