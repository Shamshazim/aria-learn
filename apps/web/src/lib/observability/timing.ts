import {
  MAX_CLIENT_TIMINGS_PER_REPORT,
  MAX_CLIENT_TIMING_MS,
  type ClientTiming,
  type ClientTimingKind,
} from '@aria/shared';

/**
 * The stopwatch behind the two §11 bars only a browser can see (X-04 part 2).
 *
 * "Audible welcome after audio is activated — starts < 1s" and "child interruption stops
 * Aria's speech — < 250ms" both begin and end inside this tab. Nothing on the server observes
 * either end, so if this module does not measure them, they are not measured.
 *
 * Framework-free and injectable throughout: the clock, the sender and the scheduler are all
 * parameters, so the whole thing is unit-testable without a browser, a timer or a fetch
 * (CODE-STANDARDS §3.2, §4). It holds no React state and renders nothing.
 */

/**
 * One report, as this module builds it.
 *
 * `sessionId` is a plain string rather than `@aria/shared`'s branded `SessionId`, because the
 * brand is a server-side guarantee — it means "this string was parsed as a session id" — and
 * the browser's copy came out of an API response as text. `api/` posts it and the API parses
 * it, which is where the brand is earned.
 */
export type TimingReport = Readonly<{
  sessionId?: string;
  timings: readonly ClientTiming[];
}>;

/** Where a finished batch goes. `api/` owns the request; this owns the measuring. */
export type TimingSender = (report: TimingReport) => Promise<void>;

/** `setTimeout`, as a port. Returns whatever cancels it. */
export type TimingScheduler = (task: () => void, delayMs: number) => () => void;

export type TurnTimingReporter = Readonly<{
  /**
   * Start measuring. Starting one that is already running restarts it, which is what an
   * interrupt needs: a child who talks over Aria twice is measuring the second one.
   */
  start(kind: ClientTimingKind): void;
  /**
   * Stop measuring and queue the duration. A no-op for a measurement that was never started,
   * so a caller never has to check — the `stop` for an interrupt that did not happen, or for
   * an audible welcome in a text-only session, is simply nothing.
   */
  stop(kind: ClientTimingKind): void;
  /** Forget a measurement in flight, for a turn that was abandoned rather than completed. */
  cancel(kind: ClientTimingKind): void;
  /** The session these measurements belong to, once the child has chosen a class. */
  bind(sessionId: string | null): void;
  /** Send what is queued now. Resolves when the attempt is over, successful or not. */
  flush(): Promise<void>;
}>;

/**
 * How long to wait for more measurements before sending.
 *
 * Long enough that the three measurements of a session's opening — arrival, unlock, first
 * audio — usually travel in one request, and short enough that a child who closes the tab
 * loses at most this much. Neither number is load-bearing: a report that never arrives costs
 * a sample, not a session.
 */
export const FLUSH_DELAY_MS = 2_000;

export function createTurnTimingReporter(deps: {
  now(): number;
  send: TimingSender;
  schedule?: TimingScheduler;
  flushDelayMs?: number;
}): TurnTimingReporter {
  const started = new Map<ClientTimingKind, number>();
  const outbox = createOutbox(deps);
  return {
    start: (kind) => {
      started.set(kind, deps.now());
    },
    stop: (kind) => {
      const from = started.get(kind);
      if (from === undefined) return;
      started.delete(kind);
      const timing = measure(kind, deps.now() - from);
      if (timing !== null) outbox.add(timing);
    },
    cancel: (kind) => {
      started.delete(kind);
    },
    bind: outbox.bind,
    flush: outbox.flush,
  };
}

/**
 * The queue between a finished measurement and a request.
 *
 * Separate from the stopwatch above because it is a different job with different failure
 * modes: the stopwatch is about marks and durations, and this is about batching, shedding and
 * a send that is allowed to fail.
 */
function createOutbox(deps: {
  send: TimingSender;
  schedule?: TimingScheduler;
  flushDelayMs?: number;
}): Readonly<{
  add(timing: ClientTiming): void;
  bind(sessionId: string | null): void;
  flush(): Promise<void>;
}> {
  const schedule = deps.schedule ?? defaultScheduler;
  const flushDelayMs = deps.flushDelayMs ?? FLUSH_DELAY_MS;
  let queue: ClientTiming[] = [];
  let sessionId: string | null = null;
  let cancelPending: (() => void) | null = null;

  const flush = async (): Promise<void> => {
    cancelPending?.();
    cancelPending = null;
    const timings = queue;
    queue = [];
    if (timings.length === 0) return;
    try {
      await deps.send(sessionId === null ? { timings } : { sessionId, timings });
    } catch {
      // Dropped, deliberately and quietly. A failed report costs one sample; a rejection that
      // propagated out of here would surface inside whatever a child was doing when the
      // measurement completed, which is the one thing telemetry must never do. The gap is
      // visible where it should be — as a fall in `*_ms_count` on the scrape side, which the
      // runbooks for both bars tell an operator to check first.
    }
  };

  return {
    add: (timing) => {
      // The report is capped, so a queue nobody has managed to send has to shed something. It
      // sheds the oldest: a full queue means sending has been failing for a while, and the
      // newest measurements describe the state somebody is about to ask about.
      if (queue.length >= MAX_CLIENT_TIMINGS_PER_REPORT) queue.shift();
      queue.push(timing);
      cancelPending ??= schedule(() => {
        void flush();
      }, flushDelayMs);
    },
    bind: (id) => {
      sessionId = id;
    },
    flush,
  };
}

/**
 * A duration the server will accept, or nothing.
 *
 * Rounded to whole milliseconds because `performance.now()` is fractional and the wire format
 * is an integer. Refused outright when it is negative or past the protocol's ceiling: a
 * monotonic clock cannot go backwards, so a negative duration means the marks were crossed by
 * a bug, and a value past the ceiling would be rejected by the API anyway — filing it would
 * spend a request to be told so.
 */
function measure(kind: ClientTimingKind, elapsedMs: number): ClientTiming | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const ms = Math.round(elapsedMs);
  return ms > MAX_CLIENT_TIMING_MS ? null : { kind, ms };
}

const defaultScheduler: TimingScheduler = (task, delayMs) => {
  const timer = window.setTimeout(task, delayMs);
  return () => {
    window.clearTimeout(timer);
  };
};
