import type { Band } from '@aria/shared';
import { BRIDGE_BUCKETS, type BridgeBucket } from '@aria/voice';

import { EARLY_BRIDGE_SEED } from './early.data';
import { MIDDLE_BRIDGE_SEED } from './middle.data';
import { SENIOR_BRIDGE_SEED } from './senior.data';

export type BridgeSeedLine = Readonly<{ band: Band; bucket: BridgeBucket; text: string }>;

/** P2H-09 asks for at least eight per bucket per band, so a bucket never runs out of choices. */
export const MIN_CLIPS_PER_BUCKET = 8;

const BY_BAND: Readonly<Record<Band, Readonly<Record<BridgeBucket, readonly string[]>>>> = {
  early: EARLY_BRIDGE_SEED,
  middle: MIDDLE_BRIDGE_SEED,
  senior: SENIOR_BRIDGE_SEED,
};

/** Every line one band's library is built from, flattened in a stable order. */
export function bridgeSeedFor(band: Band): readonly BridgeSeedLine[] {
  const seed = BY_BAND[band];
  return BRIDGE_BUCKETS.flatMap((bucket) =>
    seed[bucket].map((text) => ({ band, bucket, text }) satisfies BridgeSeedLine),
  );
}

export { BY_BAND as BRIDGE_SEED_BY_BAND };
