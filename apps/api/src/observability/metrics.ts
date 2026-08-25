export type Metrics = Readonly<{
  increment(name: string, labels: Readonly<Record<string, string>>): void;
  observe(name: string, value: number, labels: Readonly<Record<string, string>>): void;
  snapshot(): Readonly<{
    counters: Readonly<Record<string, number>>;
    histograms: Readonly<Record<string, readonly number[]>>;
  }>;
}>;

export function createMetrics(): Metrics {
  const counters = new Map<string, number>();
  const histograms = new Map<string, number[]>();
  return {
    increment(name, labels) {
      const key = metricKey(name, labels);
      counters.set(key, (counters.get(key) ?? 0) + 1);
    },
    observe(name, value, labels) {
      const key = metricKey(name, labels);
      histograms.set(key, [...(histograms.get(key) ?? []), value]);
    },
    snapshot: () => ({
      counters: Object.fromEntries(counters),
      histograms: Object.fromEntries(histograms),
    }),
  };
}

function metricKey(name: string, labels: Readonly<Record<string, string>>): string {
  const suffix = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  return suffix === '' ? name : `${name}{${suffix}}`;
}
