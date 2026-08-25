import type { Band, MoveKind } from '@aria/shared';

import type { StreamContentKind } from '@/ai';

/**
 * Which of Aria's own words may be released before the answer is finished (P2H-07).
 *
 * Prose can be cut at a full stop and each sentence checked on its own. A practice item cannot:
 * its prompt, its choices and its answer key are one thing, and half of it is not a smaller
 * question — it is a wrong one. So a `HINT` is gated as a unit and arrives as a single segment,
 * and everything a child hears while thinking is released as it is written.
 */
const SENTENCE_STREAMED: ReadonlySet<MoveKind> = new Set([
  'SAY',
  'RETEACH',
  'WELCOME',
  'END',
  'REVEAL',
]);

/** Model-written, but only safe to judge whole. One gated segment, marked as the last. */
const WHOLE_ITEM: ReadonlySet<MoveKind> = new Set(['HINT']);

/**
 * `null` means the move never reaches the segment channel at all.
 *
 * `ASK` is the case that matters: its words come from the verified content bank, not from the
 * respond stream, so there is nothing here to gate sentence by sentence and nothing to publish.
 * The item's own whole-item check is in `turn-question.ts`, where the answer key lives.
 */
export function segmentContentKind(kind: MoveKind, band: Band): StreamContentKind | null {
  if (WHOLE_ITEM.has(kind)) return 'whole-item';
  if (!SENTENCE_STREAMED.has(kind)) return null;
  // The early band's register rule is a whole-answer rule — at most two sentences (P2H-03) —
  // and a sentence already spoken cannot be taken back. So the band still gets its answer
  // through the segment channel, as one segment, checked the way its rule requires.
  return band === 'early' ? 'whole-item' : 'explanation';
}
