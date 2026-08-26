import type { Band } from '@aria/shared';

import type { BridgeBucket } from './bridge-buckets';

export type BridgeClip = Readonly<{
  /** The `speech_asset` row this audio came from. */
  id: string;
  bucket: BridgeBucket;
  band: Band;
  voice: string;
  /** What the clip says. Never displayed; it is the transcript the session records. */
  text: string;
  durationMs: number;
}>;

/**
 * How many of a bucket's own clips are off the table.
 *
 * Per bucket, not overall: a bucket holds at least eight clips, so six excluded still leaves a
 * choice, and a seventh play of the same bucket is the earliest a clip can come back. Bridges
 * play at most every other turn (rule 2), so that is fourteen turns — comfortably past the ten
 * the repetition meter watches.
 */
const RECENT_PER_BUCKET = 6;

/** A clip heard twice inside this many turns is a clip the child noticed. */
const REPEAT_WINDOW_TURNS = 10;

export type BridgePicker = Readonly<{
  /** The clip to play, or `null` when this bucket has nothing left to offer. */
  pick(
    input: Readonly<{ bucket: BridgeBucket; clips: readonly BridgeClip[]; turnIndex: number }>,
  ): BridgeClip | null;
  /** How many times a clip repeated inside the window; the golden run reports it. */
  repeats(): number;
}>;

/**
 * Picks the clip, seeded so a bot session is reproducible (P2H-09).
 *
 * Seeded rather than random because "no clip twice within ten turns" is an acceptance criterion,
 * and a criterion you cannot re-run is a hope. The seed is the session's, so two children in the
 * same band do not hear the same order.
 */
export function createBridgePicker(input: Readonly<{ seed: number }>): BridgePicker {
  const next = mulberry32(input.seed);
  const recent = new Map<BridgeBucket, string[]>();
  const lastPlayedTurn = new Map<string, number>();
  let repeats = 0;
  return {
    repeats: () => repeats,
    pick: ({ bucket, clips, turnIndex }) => {
      const inBucket = clips.filter((clip) => clip.bucket === bucket);
      if (inBucket.length === 0) return null;
      const excluded = recent.get(bucket) ?? [];
      const fresh = inBucket.filter((clip) => !excluded.includes(clip.id));
      // A bucket smaller than the window would otherwise fall silent; a heard-before clip beats
      // the machine pause it would leave behind.
      const candidates = fresh.length === 0 ? inBucket : fresh;
      const chosen = candidates[Math.floor(next() * candidates.length)] ?? candidates[0];
      if (chosen === undefined) return null;
      const previousTurn = lastPlayedTurn.get(chosen.id);
      if (previousTurn !== undefined && turnIndex - previousTurn < REPEAT_WINDOW_TURNS)
        repeats += 1;
      lastPlayedTurn.set(chosen.id, turnIndex);
      recent.set(bucket, [...excluded, chosen.id].slice(-RECENT_PER_BUCKET));
      return chosen;
    },
  };
}

/** A small, well-behaved seeded generator; the picker needs reproducibility, not cryptography. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
