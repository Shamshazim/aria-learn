export type MetricLabels = Readonly<Record<string, string>>;

export type Series<T> = { labels: MetricLabels; value: T };

/**
 * A two-level map of metric name → label combination → value, with a cap (X-04).
 *
 * Split out of `metrics.ts` so the counter and the histogram share one answer to the two
 * questions that are actually hard here: what a series is keyed by, and what happens when a
 * label turns out to have unbounded values. The store is the part with the failure mode; the
 * metrics port above it is then just two verbs.
 */
export type SeriesStore<T> = Readonly<{
  /** The series for these labels, or `null` once this metric is at its cap. */
  get(name: string, labels: MetricLabels, create: () => T): Series<T> | null;
  entries(): readonly (readonly [string, Series<T>])[];
}>;

export function createSeriesStore<T>(maxSeriesPerMetric: number): SeriesStore<T> {
  const byName = new Map<string, Map<string, Series<T>>>();
  return {
    get(name, labels, create) {
      let byLabels = byName.get(name);
      if (byLabels === undefined) {
        byLabels = new Map<string, Series<T>>();
        byName.set(name, byLabels);
      }
      const key = labelKey(labels);
      const existing = byLabels.get(key);
      if (existing !== undefined) return existing;
      if (byLabels.size >= maxSeriesPerMetric) return null;
      const created: Series<T> = { labels, value: create() };
      byLabels.set(key, created);
      return created;
    },
    entries: () =>
      [...byName.entries()].flatMap(([name, series]) =>
        [...series.values()].map((entry) => [name, entry] as const),
      ),
  };
}

/** Labels identify a series regardless of the order they were written in at the call site. */
export function labelKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

export function metricKey(name: string, labels: MetricLabels): string {
  const suffix = labelKey(labels);
  return suffix === '' ? name : `${name}{${suffix}}`;
}
