/**
 * The metrics port, and the in-process store behind it (P1-14, X-04).
 *
 * X-04 changed what a histogram keeps. It used to keep every sample in a growing array, which
 * made `observe` O(n) in the samples already taken and made an instance's memory a function of
 * its uptime — a process that served a million turns held a million floats it would only ever
 * reduce to a percentile. It now keeps bucket counts against fixed bounds: constant work per
 * observation, constant memory per series, and exactly the shape a Prometheus histogram is.
 *
 * Percentiles are then interpolated at query time by the monitoring platform rather than
 * computed here, which is also what makes them aggregatable across the several instances
 * X-01 runs. An exact p95 from one machine is not the p95 a child experienced.
 */

import { createSeriesStore, metricKey } from '@/observability/series-store';
import type { MetricLabels, SeriesStore } from '@/observability/series-store';

/**
 * Bucket bounds, in milliseconds, tuned to the bars in `master-plan.md` §11.
 *
 * Every bar sits exactly on a boundary — 250ms (interrupt to silence), 500ms (visible
 * welcome), 1000ms (content wait, audible welcome) — so the ratio that an SLO needs is a
 * bucket count read straight off, with no interpolation error at the only points that matter.
 */
export const LATENCY_BUCKETS_MS: readonly number[] = [
  25, 50, 100, 250, 500, 750, 1_000, 1_500, 2_000, 3_000, 5_000, 10_000,
];

/**
 * How many distinct label combinations one metric name may have before new ones are dropped.
 *
 * A label whose values are unbounded — a session id that slipped into a call site — turns a
 * metrics store into an unbounded map and a scrape into a timeout. The cap makes that failure
 * loud and survivable instead of fatal: the series already being recorded keep working, the
 * new ones are counted in `metrics_series_dropped_total`, and somebody sees it.
 */
export const MAX_SERIES_PER_METRIC = 200;

export const SERIES_DROPPED_TOTAL = 'metrics_series_dropped_total';

export type { MetricLabels };

export type CounterSample = Readonly<{ name: string; labels: MetricLabels; value: number }>;

export type HistogramSample = Readonly<{
  name: string;
  labels: MetricLabels;
  /** Upper bounds, ascending. `counts[i]` is the number of observations in bucket `i`. */
  bounds: readonly number[];
  counts: readonly number[];
  sum: number;
  count: number;
}>;

export type MetricsCollection = Readonly<{
  counters: readonly CounterSample[];
  histograms: readonly HistogramSample[];
}>;

export type Metrics = Readonly<{
  increment(name: string, labels: MetricLabels): void;
  observe(name: string, value: number, labels: MetricLabels): void;
  /** Structured, for an exporter. Labels are kept apart from the name, never re-parsed. */
  collect(): MetricsCollection;
  /** Flat keys, for a test or a log line that wants one string per series. */
  snapshot(): Readonly<{
    counters: Readonly<Record<string, number>>;
    histograms: Readonly<Record<string, Readonly<{ count: number; sum: number }>>>;
  }>;
}>;

type Histogram = { counts: number[]; sum: number; count: number };

export function createMetrics(
  options: Readonly<{ buckets?: readonly number[]; maxSeriesPerMetric?: number }> = {},
): Metrics {
  const bounds = options.buckets ?? LATENCY_BUCKETS_MS;
  const maxSeries = options.maxSeriesPerMetric ?? MAX_SERIES_PER_METRIC;
  const counters = createSeriesStore<number>(maxSeries);
  const histograms = createSeriesStore<Histogram>(maxSeries);
  const emptyHistogram = (): Histogram => ({
    counts: new Array<number>(bounds.length + 1).fill(0),
    sum: 0,
    count: 0,
  });

  /** A series the cap refused. Counted, so the label that is exploding can be found. */
  function dropped(name: string): void {
    const series = counters.get(SERIES_DROPPED_TOTAL, { metric: name }, () => 0);
    if (series !== null) series.value += 1;
  }

  return {
    increment(name, labels) {
      const series = counters.get(name, labels, () => 0);
      if (series === null) {
        dropped(name);
        return;
      }
      series.value += 1;
    },

    observe(name, value, labels) {
      const series = histograms.get(name, labels, emptyHistogram);
      if (series === null) {
        dropped(name);
        return;
      }
      const bucket = bucketOf(bounds, value);
      series.value.counts[bucket] = (series.value.counts[bucket] ?? 0) + 1;
      series.value.sum += value;
      series.value.count += 1;
    },

    collect: () => collect(counters, histograms, bounds),
    snapshot: () => snapshot(counters, histograms),
  };
}

function collect(
  counters: SeriesStore<number>,
  histograms: SeriesStore<Histogram>,
  bounds: readonly number[],
): MetricsCollection {
  return {
    counters: counters
      .entries()
      .map(([name, series]) => ({ name, labels: series.labels, value: series.value })),
    histograms: histograms.entries().map(([name, series]) => ({
      name,
      labels: series.labels,
      bounds,
      counts: [...series.value.counts],
      sum: series.value.sum,
      count: series.value.count,
    })),
  };
}

function snapshot(
  counters: SeriesStore<number>,
  histograms: SeriesStore<Histogram>,
): ReturnType<Metrics['snapshot']> {
  return {
    counters: Object.fromEntries(
      counters.entries().map(([name, series]) => [metricKey(name, series.labels), series.value]),
    ),
    histograms: Object.fromEntries(
      histograms
        .entries()
        .map(([name, series]) => [
          metricKey(name, series.labels),
          { count: series.value.count, sum: series.value.sum },
        ]),
    ),
  };
}

/**
 * The index of the first bucket whose bound is not below `value`.
 *
 * A linear scan, because the bound list is a dozen entries: at that size the branch predictor
 * beats a binary search's arithmetic, and this runs on every observation.
 */
function bucketOf(bounds: readonly number[], value: number): number {
  for (let index = 0; index < bounds.length; index += 1) {
    if (value <= (bounds[index] ?? Infinity)) return index;
  }
  return bounds.length;
}
