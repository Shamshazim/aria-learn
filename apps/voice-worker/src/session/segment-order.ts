import type { MoveSegment, SpokenPrefix } from '@aria/shared';

/**
 * P2H-07: puts the sentences back in the order they were written.
 *
 * The API releases a sentence the moment it is safe to say, and the network is free to reorder
 * or repeat them on the way here. A child must never hear the second half of an explanation
 * first, or the same sentence twice, or a sentence from an answer they already talked over — so
 * nothing is spoken until every sentence before it has been.
 */
export type SegmentOrder = Readonly<{
  /** The sentences that became speakable because this one arrived. Usually one, sometimes none. */
  accept(segment: MoveSegment): readonly MoveSegment[];
  /** The child interrupted: this generation is over and its late sentences are noise. */
  cancel(generationId: string): void;
  /** True once a move's own sentences have been spoken, so the move must not be spoken again. */
  wasSpoken(moveId: string): boolean;
  /** How far into an interrupted answer the child actually got, once and then forgotten. */
  takeInterruptedPrefix(): SpokenPrefix | null;
}>;

/**
 * A gap this wide is a lost sentence, not a late one, and holding the ones behind it would
 * leave a child in silence waiting for something that is not coming.
 */
const MAX_HELD = 8;

export function createSegmentOrder(): SegmentOrder {
  const cancelled = new Set<string>();
  const nextIndex = new Map<string, number>();
  const held = new Map<string, Map<number, MoveSegment>>();
  const spokenMoves = new Set<string>();
  let lastSpoken: SpokenPrefix | null = null;
  let interrupted: SpokenPrefix | null = null;

  const drain = (generationId: string): readonly MoveSegment[] => {
    const waiting = held.get(generationId) ?? new Map<number, MoveSegment>();
    const ready: MoveSegment[] = [];
    let index = nextIndex.get(generationId) ?? 0;
    for (let segment = waiting.get(index); segment !== undefined; segment = waiting.get(index)) {
      ready.push(segment);
      waiting.delete(index);
      spokenMoves.add(segment.moveId);
      lastSpoken = { generationId, index };
      index += 1;
    }
    nextIndex.set(generationId, index);
    if (waiting.size === 0) held.delete(generationId);
    return ready;
  };

  return {
    accept: (segment) => {
      if (cancelled.has(segment.generationId)) return [];
      const next = nextIndex.get(segment.generationId) ?? 0;
      if (segment.index < next) return [];
      const waiting = held.get(segment.generationId) ?? new Map<number, MoveSegment>();
      // The sentence that is due is never refused: refusing it is what would cause the silence.
      if (segment.index > next && waiting.size >= MAX_HELD && !waiting.has(segment.index))
        return [];
      waiting.set(segment.index, segment);
      held.set(segment.generationId, waiting);
      return drain(segment.generationId);
    },
    cancel: (generationId) => {
      cancelled.add(generationId);
      held.delete(generationId);
      if (lastSpoken?.generationId === generationId) interrupted = lastSpoken;
    },
    wasSpoken: (moveId) => spokenMoves.has(moveId),
    takeInterruptedPrefix: () => {
      const prefix = interrupted;
      interrupted = null;
      return prefix;
    },
  };
}
