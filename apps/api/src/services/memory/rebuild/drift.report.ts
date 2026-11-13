/**
 * How far live memory has drifted from what the raw log supports (P3-02, `master-plan.md` §4.2).
 *
 * Both sides are reduced to `(kind, normalised value)`: two facts that say the same thing in the
 * same words are the same memory, whatever their ids. Drift is |symmetric difference| / |union|
 * — 0 when they agree, 1 when they share nothing — and the report names every key on either
 * side alone, so a person can see *what* drifted, not only how much.
 */
export type MemoryKeyed = Readonly<{ kind: string; text: string }>;

export type DriftReport = Readonly<{
  driftScore: number;
  onlyInShadow: readonly string[];
  onlyInLive: readonly string[];
  counts: Readonly<{ shadow: number; live: number; shared: number }>;
}>;

export function driftReport(
  shadow: readonly MemoryKeyed[],
  live: readonly MemoryKeyed[],
): DriftReport {
  const shadowKeys = new Set(shadow.map(key));
  const liveKeys = new Set(live.map(key));
  const onlyInShadow = [...shadowKeys].filter((item) => !liveKeys.has(item)).sort();
  const onlyInLive = [...liveKeys].filter((item) => !shadowKeys.has(item)).sort();
  const union = new Set([...shadowKeys, ...liveKeys]).size;
  const differing = onlyInShadow.length + onlyInLive.length;
  return {
    driftScore: union === 0 ? 0 : Math.round((differing / union) * 10_000) / 10_000,
    onlyInShadow,
    onlyInLive,
    counts: { shadow: shadowKeys.size, live: liveKeys.size, shared: union - differing },
  };
}

function key(item: MemoryKeyed): string {
  const text = item.text
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/[.!?\s]+$/u, '')
    .trim();
  return `${item.kind}|${text}`;
}
