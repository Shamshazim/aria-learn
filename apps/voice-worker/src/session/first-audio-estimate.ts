/**
 * How long this session's last few turns took to produce their first sentence (P2H-09 rule 1).
 *
 * Measured rather than assumed, and per session, because the number that decides whether a gap
 * is worth covering is this child's connection to this deployment right now — not a figure from
 * a benchmark. Until five turns have been timed there is no estimate, and a bridge plays.
 */
export type FirstAudioEstimate = Readonly<{
  /** A turn started; the clock runs until `heard` or the next `started`. */
  started(nowMs: number): void;
  /** The first gated sentence of that turn reached the speaker. */
  heard(nowMs: number): void;
  /** The median of the last five turns, or `null` while there are fewer than five. */
  expectedMs(): number | null;
}>;

const WINDOW = 5;

export function createFirstAudioEstimate(): FirstAudioEstimate {
  const samples: number[] = [];
  let startedAt: number | null = null;
  return {
    started: (nowMs) => {
      startedAt = nowMs;
    },
    heard: (nowMs) => {
      if (startedAt === null) return;
      samples.push(Math.max(0, nowMs - startedAt));
      // Only the first sentence of a turn is a first-audio measurement; the rest are the tail
      // of the same answer, and counting them would make a long answer look like a slow one.
      startedAt = null;
      if (samples.length > WINDOW) samples.shift();
    },
    expectedMs: () => {
      if (samples.length < WINDOW) return null;
      const ordered = [...samples].sort((left, right) => left - right);
      return ordered[Math.floor(ordered.length / 2)] ?? null;
    },
  };
}
