export type MetricValue = Readonly<{
  value: number | null;
  sampleSize: number;
  status: 'met' | 'missed' | 'not_enough_data' | 'target';
}>;

export type MetricEvent = Readonly<{
  sessionId: string;
  seq: number;
  actor: string;
  kind: string;
  correct: boolean | null;
  latencyMs: number | null;
  evidence: Readonly<Record<string, unknown>>;
}>;

export function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? null;
}

export function hintEffectiveness(events: readonly MetricEvent[]): MetricValue {
  let hints = 0;
  let helped = 0;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]?.kind !== 'HINT') continue;
    const hint = events[index];
    const next = events
      .slice(index + 1)
      .find(
        (event) =>
          event.sessionId === hint?.sessionId && event.actor === 'child' && event.kind === 'ANSWER',
      );
    if (next === undefined) continue;
    hints += 1;
    if (next.correct === true) helped += 1;
  }
  return ratio(helped, hints, (value) => value > 0.6);
}

export function approachChangeViolations(events: readonly MetricEvent[]): MetricValue {
  let violations = 0;
  let samples = 0;
  const states = new Map<string, ApproachState>();
  for (const event of events) {
    if (event.actor === 'child' && event.kind === 'ANSWER') {
      trackAnswer(states, event);
      continue;
    }
    const comparison = trackTutorResponse(states, event);
    samples += comparison.sample;
    violations += comparison.violation;
  }
  return {
    value: violations,
    sampleSize: samples,
    status: samples === 0 ? 'not_enough_data' : violations === 0 ? 'met' : 'missed',
  };
}

type ApproachState = { waiting: boolean; prior?: string };

function trackAnswer(states: Map<string, ApproachState>, event: MetricEvent): void {
  const current = states.get(event.sessionId) ?? { waiting: false };
  if (event.correct === false) states.set(event.sessionId, { ...current, waiting: true });
  else states.set(event.sessionId, { waiting: false });
}

function trackTutorResponse(
  states: Map<string, ApproachState>,
  event: MetricEvent,
): Readonly<{ sample: number; violation: number }> {
  const state = states.get(event.sessionId);
  if (event.actor !== 'aria' || state?.waiting !== true || !isTeachingResponse(event.kind)) {
    return { sample: 0, violation: 0 };
  }
  const approach = event.evidence.approach;
  if (typeof approach !== 'string') return { sample: 0, violation: 0 };
  states.set(event.sessionId, { waiting: false, prior: approach });
  if (state.prior === undefined) return { sample: 0, violation: 0 };
  return { sample: 1, violation: state.prior === approach ? 1 : 0 };
}

function isTeachingResponse(kind: string): boolean {
  return kind === 'HINT' || kind === 'RETEACH' || kind === 'REVEAL';
}

export function p95Under(values: readonly number[], bar: number): MetricValue {
  const value = percentile(values, 0.95);
  return {
    value,
    sampleSize: values.length,
    status: value === null ? 'not_enough_data' : value < bar ? 'met' : 'missed',
  };
}

export function ratioUnder(numerator: number, denominator: number, bar: number): MetricValue {
  return ratio(numerator, denominator, (value) => value < bar);
}

export function evidenceCoverage(facts: number, supported: number): MetricValue {
  return ratio(supported, facts, (value) => value === 1);
}

function ratio(
  numerator: number,
  denominator: number,
  passes: (value: number) => boolean,
): MetricValue {
  if (denominator === 0) return { value: null, sampleSize: 0, status: 'not_enough_data' };
  const value = numerator / denominator;
  return { value, sampleSize: denominator, status: passes(value) ? 'met' : 'missed' };
}
