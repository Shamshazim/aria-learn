import type { Band } from '@aria/shared';
import { playableBuckets, type BridgeBucket } from '@aria/voice';

import { EARLY_BRIDGE_SEED } from './early.data';
import { MIDDLE_BRIDGE_SEED } from './middle.data';
import { SENIOR_BRIDGE_SEED } from './senior.data';

export type BridgeSeedLine = Readonly<{ band: Band; bucket: BridgeBucket; text: string }>;

/** P2H-09 asks for at least eight per bucket per band, so a bucket never runs out of choices. */
export const MIN_CLIPS_PER_BUCKET = 8;

type BandSeed = Readonly<Partial<Record<BridgeBucket, readonly string[]>>>;

const BY_BAND: Readonly<Record<Band, BandSeed>> = {
  early: EARLY_BRIDGE_SEED,
  middle: MIDDLE_BRIDGE_SEED,
  senior: SENIOR_BRIDGE_SEED,
};

/**
 * Every line one band's library is built from, flattened in a stable order.
 *
 * Driven by `playableBuckets`, not by what happens to be in the seed file: a band that gains a
 * bucket in the rules gains it here, and a line for a bucket the rules will never play is not
 * planned, not synthesised and not put in front of a reviewer.
 */
export function bridgeSeedFor(band: Band): readonly BridgeSeedLine[] {
  const seed = BY_BAND[band];
  return playableBuckets(band).flatMap((bucket) =>
    (seed[bucket] ?? []).map((text) => ({ band, bucket, text }) satisfies BridgeSeedLine),
  );
}
