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
  /** A new stream is starting; nothing a previous one half-said carries into it. */
  begin(): void;
  /** The child interrupted: this generation is over and its late sentences are noise. */
  cancel(generationId: string): void;
  /**
   * This stream ran to its closing frame, so what it said a sentence at a time was the whole of
   * what it wrote. Until then a partly-spoken move is not considered spoken at all, and replaying
   * it whole is how the child hears the rest.
   */
  settle(): void;
  /** True once a move has been spoken in full, a sentence at a time. */
  wasSpoken(moveId: string): boolean;
  /** How far into an interrupted answer the child got, once and then forgotten. */
  takeInterruptedPrefix(): SpokenPrefix | null;
}>;

/**
 * A gap this wide is a lost sentence, not a late one. Holding the ones behind it would leave a
 * child in silence waiting for something that is not coming, so the stream skips the gap.
 */
const MAX_HELD = 8;

/** Takes the run of sentences starting at `from`, leaving anything behind a gap where it is. */
function drainFrom(waiting: Map<number, MoveSegment>, from: number): readonly MoveSegment[] {
  const ready: MoveSegment[] = [];
  for (let index = from; ; index += 1) {
    const segment = waiting.get(index);
    if (segment === undefined) return ready;
    ready.push(segment);
    waiting.delete(index);
  }
}

/** The sentence that would unblock the rest never came; carry on from the next one there is. */
function skipGap(
  nextIndex: Map<string, number>,
  generationId: string,
  waiting: Map<number, MoveSegment>,
): void {
  nextIndex.set(generationId, Math.min(...waiting.keys()));
}

export function createSegmentOrder(): SegmentOrder {
  const cancelled = new Set<string>();
  const nextIndex = new Map<string, number>();
  const held = new Map<string, Map<number, MoveSegment>>();
  const heardMoves = new Set<string>();
  const spokenMoves = new Set<string>();
  let lastSpoken: SpokenPrefix | null = null;
  let interrupted: SpokenPrefix | null = null;

  const drain = (generationId: string): readonly MoveSegment[] => {
    const waiting = held.get(generationId) ?? new Map<number, MoveSegment>();
    const ready = drainFrom(waiting, nextIndex.get(generationId) ?? 0);
    for (const segment of ready) heardMoves.add(segment.moveId);
    const last = ready.at(-1);
    if (last !== undefined) lastSpoken = { generationId, index: last.index };
    nextIndex.set(generationId, (last?.index ?? (nextIndex.get(generationId) ?? 0) - 1) + 1);
    if (waiting.size === 0) held.delete(generationId);
    return ready;
  };

  return {
    begin: () => {
      heardMoves.clear();
    },
    accept: (segment) => {
      if (cancelled.has(segment.generationId)) return [];
      const next = nextIndex.get(segment.generationId) ?? 0;
      if (segment.index < next) return [];
      const waiting = held.get(segment.generationId) ?? new Map<number, MoveSegment>();
      waiting.set(segment.index, segment);
      held.set(segment.generationId, waiting);
      // The sentence that is due is never refused: refusing it is what would cause the silence.
      if (segment.index > next && waiting.size > MAX_HELD) {
        skipGap(nextIndex, segment.generationId, waiting);
      }
      return drain(segment.generationId);
    },
    cancel: (generationId) => {
      cancelled.add(generationId);
      held.delete(generationId);
      if (lastSpoken?.generationId === generationId) interrupted = lastSpoken;
    },
    settle: () => {
      for (const moveId of heardMoves) spokenMoves.add(moveId);
      heardMoves.clear();
    },
    wasSpoken: (moveId) => spokenMoves.has(moveId),
    takeInterruptedPrefix: () => {
      const prefix = interrupted;
      interrupted = null;
      return prefix;
    },
  };
}
