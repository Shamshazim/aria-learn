import { describe, expect, it } from 'vitest';

import { BRIDGE_BUCKETS } from './bridge-buckets';
import { createBridgePicker, type BridgeClip } from './bridge-picker';

import type { BridgeBucket } from './bridge-buckets';

function library(bucket: BridgeBucket, count: number): readonly BridgeClip[] {
  return Array.from({ length: count }, (_value, index) => ({
    id: `${bucket}-${String(index)}`,
    bucket,
    band: 'middle' as const,
    voice: 'voice-middle',
    text: `Clip ${String(index)}.`,
    durationMs: 900,
  }));
}

describe('bridge picker', () => {
  it('plays no clip twice within ten turns across a thirty-turn session', () => {
    const picker = createBridgePicker({ seed: 7 });
    const clips = BRIDGE_BUCKETS.flatMap((bucket) => library(bucket, 8));
    const playedAt = new Map<string, number>();

    // Rule 2 lets a bridge play every other turn, so thirty turns is fifteen bridges.
    for (let turnIndex = 0; turnIndex < 30; turnIndex += 2) {
      const bucket = BRIDGE_BUCKETS[(turnIndex / 2) % BRIDGE_BUCKETS.length] ?? 'acknowledge';
      const clip = picker.pick({ bucket, clips, turnIndex });
      expect(clip).not.toBeNull();
      const previous = playedAt.get(clip?.id ?? '');
      expect(previous === undefined || turnIndex - previous >= 10).toBe(true);
      playedAt.set(clip?.id ?? '', turnIndex);
    }

    expect(picker.repeats()).toBe(0);
  });

  it('is reproducible from its seed and different between seeds', () => {
    const clips = library('acknowledge', 8);
    const run = (seed: number): readonly (string | null)[] => {
      const picker = createBridgePicker({ seed });
      return Array.from(
        { length: 6 },
        (_value, turnIndex) =>
          picker.pick({ bucket: 'acknowledge', clips, turnIndex: turnIndex * 2 })?.id ?? null,
      );
    };

    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });

  it('counts a repeat inside the window rather than hiding it', () => {
    const picker = createBridgePicker({ seed: 3 });
    const clips = library('thinking', 1);

    picker.pick({ bucket: 'thinking', clips, turnIndex: 0 });
    picker.pick({ bucket: 'thinking', clips, turnIndex: 4 });

    expect(picker.repeats()).toBe(1);
  });

  it('returns nothing when the bucket is empty rather than reaching into another', () => {
    const picker = createBridgePicker({ seed: 1 });

    expect(
      picker.pick({ bucket: 'transition', clips: library('acknowledge', 8), turnIndex: 0 }),
    ).toBeNull();
  });
});
