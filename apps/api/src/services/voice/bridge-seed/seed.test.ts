import { describe, expect, it } from 'vitest';

import { BANDS } from '@aria/shared';
import { BRIDGE_BUCKETS, bridgeTextIsNonCommittal } from '@aria/voice';

import { bridgeSeedFor, MIN_CLIPS_PER_BUCKET } from '.';

describe('bridge seed texts', () => {
  it.each(BANDS)('gives the %s band enough to choose from in every bucket', (band) => {
    const seed = bridgeSeedFor(band);

    for (const bucket of BRIDGE_BUCKETS) {
      const lines = seed.filter((line) => line.bucket === bucket);
      expect(lines.length).toBeGreaterThanOrEqual(MIN_CLIPS_PER_BUCKET);
    }
  });

  it.each(BANDS)('never lets the %s band judge an answer before the answer exists', (band) => {
    const committal = bridgeSeedFor(band)
      .map((line) => line.text)
      .filter((text) => !bridgeTextIsNonCommittal(text));

    expect(committal).toEqual([]);
  });

  it.each(BANDS)('has no duplicate line in the %s band, so no clip is recorded twice', (band) => {
    const texts = bridgeSeedFor(band).map((line) => line.text);

    expect(texts).toHaveLength(new Set(texts).size);
  });

  it.each(BANDS)('keeps every %s line short enough to be under the seam', (band) => {
    // Under a second of speech is roughly a dozen words; the synthesiser enforces the real
    // limit in milliseconds, and this is the cheap check that catches a sentence in a seed file.
    const long = bridgeSeedFor(band).filter((line) => line.text.split(/\s+/u).length > 8);

    expect(long).toEqual([]);
  });
});
