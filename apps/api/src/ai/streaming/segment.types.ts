/**
 * P2H-07: a sentence that has passed the gate, addressed well enough to travel.
 *
 * `ReleasedSegment` is what the gated streamer produces — the sentence and what it cost to
 * check it. A `GatedSegment` is that sentence once it belongs to a generation and a move, which
 * is what a consumer needs to order it, deduplicate it, and drop it after a barge-in.
 */
export type GatedSegment = Readonly<{
  generationId: string;
  moveId: string;
  index: number;
  text: string;
  speech: string;
  isLast: boolean;
}>;
