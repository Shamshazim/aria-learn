import { describe, expect, it, vi } from 'vitest';

import { MAX_CLIENT_TIMINGS_PER_REPORT } from '@aria/shared';

import {
  createTurnTimingReporter,
  type TimingReport,
  type TurnTimingReporter,
} from '@/lib/observability/timing';

/**
 * X-04 part 2: the client half of the two §11 bars nothing else can see.
 *
 * Every dependency is injected, so none of this needs a browser, a timer or a fetch: the clock
 * is a counter the test moves by hand, and the scheduler hands back a function the test calls
 * when it wants the flush to happen.
 */
describe('measuring a turn in the browser', () => {
  it('reports the duration between a start and its stop', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('audible_welcome');
    clock.advance(840);
    reporter.stop('audible_welcome');
    await flushNow();

    expect(sent).toEqual([{ timings: [{ kind: 'audible_welcome', ms: 840 }] }]);
  });

  it('names the session once one exists, and nothing before that', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('arrival_visible');
    clock.advance(300);
    reporter.stop('arrival_visible');
    await flushNow();

    reporter.bind('session-1');
    reporter.start('audible_welcome');
    clock.advance(500);
    reporter.stop('audible_welcome');
    await flushNow();

    expect(sent[0]).toEqual({ timings: [{ kind: 'arrival_visible', ms: 300 }] });
    expect(sent[1]).toEqual({
      sessionId: 'session-1',
      timings: [{ kind: 'audible_welcome', ms: 500 }],
    });
  });

  it('batches the measurements of one opening into a single report', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('audio_unlocked');
    clock.advance(120);
    reporter.stop('audio_unlocked');
    reporter.start('audible_welcome');
    clock.advance(640);
    reporter.stop('audible_welcome');
    await flushNow();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.timings).toEqual([
      { kind: 'audio_unlocked', ms: 120 },
      { kind: 'audible_welcome', ms: 640 },
    ]);
  });

  /** A child who talks over Aria twice is measuring the second interruption, not both. */
  it('restarts a measurement that was already running', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('interrupt_silence');
    clock.advance(5_000);
    reporter.start('interrupt_silence');
    clock.advance(200);
    reporter.stop('interrupt_silence');
    await flushNow();

    expect(sent[0]?.timings).toEqual([{ kind: 'interrupt_silence', ms: 200 }]);
  });

  it('ignores a stop for something that was never started', async () => {
    const { reporter, flushNow, sent } = build();

    reporter.stop('interrupt_silence');
    await flushNow();

    expect(sent).toEqual([]);
  });

  it('forgets a cancelled measurement, so an abandoned turn reports nothing', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('arrival_visible');
    clock.advance(400);
    reporter.cancel('arrival_visible');
    reporter.stop('arrival_visible');
    await flushNow();

    expect(sent).toEqual([]);
  });

  /**
   * The protocol's ceiling is ten minutes. Past it the API would refuse the whole report, so
   * filing the measurement would spend a request to be told so — and take the believable
   * measurements in the same batch down with it.
   */
  it('drops a duration past the protocol ceiling rather than sending it', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('audible_welcome');
    clock.advance(11 * 60 * 1_000);
    reporter.stop('audible_welcome');
    await flushNow();

    expect(sent).toEqual([]);
  });

  it('rounds a fractional clock to whole milliseconds, because the wire format is an integer', async () => {
    const { reporter, clock, flushNow, sent } = build();

    reporter.start('interrupt_silence');
    clock.advance(187.6);
    reporter.stop('interrupt_silence');
    await flushNow();

    expect(sent[0]?.timings).toEqual([{ kind: 'interrupt_silence', ms: 188 }]);
  });

  it('sheds the oldest measurement rather than growing past the report cap', async () => {
    const { reporter, clock, flushNow, sent } = build();

    for (let index = 0; index < MAX_CLIENT_TIMINGS_PER_REPORT + 3; index += 1) {
      reporter.start('interrupt_silence');
      clock.advance(index + 1);
      reporter.stop('interrupt_silence');
    }
    await flushNow();

    expect(sent[0]?.timings).toHaveLength(MAX_CLIENT_TIMINGS_PER_REPORT);
    // The first three were shed, so the batch starts at the fourth measurement's duration.
    expect(sent[0]?.timings[0]).toEqual({ kind: 'interrupt_silence', ms: 4 });
  });

  it('sends nothing when there is nothing queued', async () => {
    const { reporter, sent } = build();

    await reporter.flush();

    expect(sent).toEqual([]);
  });

  /**
   * The one guarantee the rest of the app relies on: telemetry can fail, and a child's session
   * does not notice. A rejection escaping here would surface inside whatever they were doing
   * when the measurement happened to complete.
   */
  it('swallows a failed send, and keeps measuring afterwards', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { reporter, clock, flushNow } = build({ send });

    reporter.start('audible_welcome');
    clock.advance(500);
    reporter.stop('audible_welcome');
    await expect(flushNow()).resolves.toBeUndefined();

    reporter.start('audible_welcome');
    clock.advance(600);
    reporter.stop('audible_welcome');
    await flushNow();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('schedules one flush for a burst, not one per measurement', () => {
    const schedule = vi.fn(() => () => undefined);
    const { reporter, clock } = build({ schedule });

    for (const kind of ['audio_unlocked', 'audible_welcome'] as const) {
      reporter.start(kind);
      clock.advance(100);
      reporter.stop(kind);
    }

    expect(schedule).toHaveBeenCalledTimes(1);
  });
});

function build(
  options: Readonly<{
    send?: (report: TimingReport) => Promise<void>;
    schedule?: (task: () => void, delayMs: number) => () => void;
  }> = {},
) {
  const sent: TimingReport[] = [];
  let elapsed = 0;
  let pending: (() => void) | null = null;
  const reporter: TurnTimingReporter = createTurnTimingReporter({
    now: () => elapsed,
    send:
      options.send ??
      ((report) => {
        sent.push(report);
        return Promise.resolve();
      }),
    schedule:
      options.schedule ??
      ((task) => {
        pending = task;
        return () => {
          pending = null;
        };
      }),
  });
  return {
    reporter,
    sent,
    clock: {
      advance: (ms: number) => {
        elapsed += ms;
      },
    },
    /** Fire the scheduled flush the way a timer would, and wait for the send it starts. */
    flushNow: async (): Promise<void> => {
      pending?.();
      await reporter.flush();
    },
  };
}
