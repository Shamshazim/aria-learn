import type { HistogramSample, MetricsCollection, MetricLabels } from '@/observability/metrics';

/**
 * Renders the metrics store in the Prometheus text exposition format (X-04).
 *
 * Prometheus rather than a vendor SDK because X-01 put us on Fly, whose managed metrics
 * scrape exactly this, and because it is the one format every other platform also ingests —
 * so the exporter is not a bet on the monitoring vendor outliving the product.
 *
 * Pure: a collection in, a string out. Nothing here reads a clock, a socket or the process, so
 * the whole exposition can be asserted character by character in a test.
 */

/**
 * Label names that must never appear on a metric (X-04: "never student or session id").
 *
 * The reason is not tidiness, it is §12: metrics leave the process, go to a third party, and
 * are kept for months by a system nobody prunes per-child. A series is cheap to add at a call
 * site and impossible to un-send, so the check lives at the boundary they leave through.
 */
const FORBIDDEN_LABEL_NAMES: readonly RegExp[] = [
  /(^|_)(student|session|child|parent|user|account|device)_?id$/iu,
  /(^|_)(email|name|address|phone)$/iu,
  /^(studentid|sessionid|childid|parentid|userid)$/iu,
];

/**
 * Label *values* that look like an identifier whatever the label is called.
 *
 * The name list above catches the honest mistake. This catches the one that matters: a label
 * called `room` or `key` whose value turns out to be a UUID.
 */
const IDENTIFIER_VALUES: readonly RegExp[] = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
  /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/iu,
  /^[0-9a-f]{32,}$/iu,
];

export const SERIES_REJECTED_TOTAL = 'metrics_series_rejected_total';

export type ExportResult = Readonly<{
  /** The exposition body, `text/plain; version=0.0.4`. */
  body: string;
  /** Series withheld because a label would have carried an identifier. */
  rejected: number;
}>;

export function renderPrometheus(collection: MetricsCollection): ExportResult {
  const counters = collection.counters.filter((sample) => isPermitted(sample.labels));
  const histograms = collection.histograms.filter((sample) => isPermitted(sample.labels));
  const rejected =
    collection.counters.length -
    counters.length +
    (collection.histograms.length - histograms.length);

  const lines = [
    ...group(counters, 'counter', (sample) => [line(sample.name, sample.labels, sample.value)]),
    ...group(histograms, 'histogram', histogramLines),
    ...rejectedLines(rejected),
  ];
  // A trailing newline is required by the format; a scrape of an empty store is still valid.
  return { body: lines.length === 0 ? '\n' : `${lines.join('\n')}\n`, rejected };
}

/**
 * `# TYPE` is emitted once per metric name, before its first series, as the format requires.
 *
 * Samples arrive grouped by nothing in particular, so they are grouped here rather than
 * relying on the store's iteration order — which is insertion order, and would put a second
 * `# TYPE` line in the middle of a metric the moment a new label combination appeared.
 */
function group<T extends Readonly<{ name: string }>>(
  samples: readonly T[],
  type: 'counter' | 'histogram',
  render: (sample: T) => readonly string[],
): readonly string[] {
  const byName = new Map<string, T[]>();
  for (const sample of samples) {
    const existing = byName.get(sample.name);
    if (existing === undefined) byName.set(sample.name, [sample]);
    else existing.push(sample);
  }
  return [...byName.entries()].flatMap(([name, group_]) => [
    `# TYPE ${name} ${type}`,
    ...group_.flatMap(render),
  ]);
}

/**
 * The cumulative form Prometheus defines: each `le` bucket counts everything at or below it,
 * and `+Inf` counts everything. The store keeps them un-cumulated, so they are summed here.
 */
function histogramLines(sample: HistogramSample): readonly string[] {
  let cumulative = 0;
  const buckets = sample.bounds.map((bound, index) => {
    cumulative += sample.counts[index] ?? 0;
    return line(`${sample.name}_bucket`, { ...sample.labels, le: formatNumber(bound) }, cumulative);
  });
  return [
    ...buckets,
    line(`${sample.name}_bucket`, { ...sample.labels, le: '+Inf' }, sample.count),
    line(`${sample.name}_sum`, sample.labels, sample.sum),
    line(`${sample.name}_count`, sample.labels, sample.count),
  ];
}

function rejectedLines(rejected: number): readonly string[] {
  if (rejected === 0) return [];
  return [`# TYPE ${SERIES_REJECTED_TOTAL} counter`, line(SERIES_REJECTED_TOTAL, {}, rejected)];
}

export function isPermitted(labels: MetricLabels): boolean {
  return Object.entries(labels).every(
    ([name, value]) =>
      !FORBIDDEN_LABEL_NAMES.some((pattern) => pattern.test(name)) &&
      !IDENTIFIER_VALUES.some((pattern) => pattern.test(value)),
  );
}

function line(name: string, labels: MetricLabels, value: number): string {
  const rendered = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, label]) => `${key}="${escapeLabel(label)}"`)
    .join(',');
  return `${name}${rendered === '' ? '' : `{${rendered}}`} ${formatNumber(value)}`;
}

/** Backslash, double quote and newline are the three the format reserves inside a value. */
function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

/**
 * Integers without a decimal point, everything else at a fixed precision.
 *
 * A sum of milliseconds accumulated as floats prints as `1234.5600000000002` otherwise, which
 * is noise in every diff of a scrape and in every alert that quotes the value back.
 */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '+Inf' : '-Inf';
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}
