import type { Band, MoveKind } from '@aria/shared';

/**
 * Which moves may be spoken before they are finished (P2H-07).
 *
 * Prose can be cut at a full stop and each sentence checked on its own. A practice item cannot:
 * its prompt, its choices and its answer key are one thing, and half of it is not a smaller
 * question — it is a wrong one. So `ASK` and `HINT` are gated as a unit, and everything a child
 * hears while thinking is released as it is written.
 */
const SENTENCE_STREAMED: ReadonlySet<MoveKind> = new Set([
  'SAY',
  'RETEACH',
  'WELCOME',
  'END',
  'REVEAL',
]);

/**
 * The early band is deliberately excluded.
 *
 * Its register rule is a whole-answer rule — at most two sentences (P2H-03) — and a sentence
 * already spoken cannot be taken back. Two sentences are also short enough that buffering them
 * costs a child almost nothing, so the rule stays enforceable and the latency stays paid for
 * where it is actually long.
 */
export function maySegmentStream(kind: MoveKind, band: Band): boolean {
  return band !== 'early' && SENTENCE_STREAMED.has(kind);
}
