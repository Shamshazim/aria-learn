import { describe, expect, it, vi } from 'vitest';

import { createVoiceTimings } from '@/features/voice/model/voice-timings';
import type { TurnTimingReporter } from '@/lib/observability/timing';

/**
 * X-04 part 2: which voice event means "the speaker made a sound" and which means "she
 * stopped".
 *
 * The reporter is faked at the port, so these assertions are about the protocol decisions and
 * nothing else — no room, no React, no audio.
 */
describe('the voice end of the client timings', () => {
  it('starts the unlock clock when the room connects', () => {
    const { timings, reporter } = build();

    timings.roomConnected();

    expect(reporter.start).toHaveBeenCalledWith('audio_unlocked');
  });

  it('closes the audible welcome the first time an audio element starts playing', () => {
    const { timings, reporter } = build();
    const element = new EventTarget() as HTMLMediaElement;

    timings.watchAudioElement(element);
    element.dispatchEvent(new Event('playing'));
    element.dispatchEvent(new Event('playing'));

    expect(reporter.stop).toHaveBeenCalledTimes(1);
    expect(reporter.stop).toHaveBeenCalledWith('audible_welcome');
  });

  it('does not touch the clock before the element plays', () => {
    const { timings, reporter } = build();

    timings.watchAudioElement(new EventTarget() as HTMLMediaElement);

    expect(reporter.stop).not.toHaveBeenCalled();
  });

  /**
   * The backstop. `stop` is a no-op once the measurement has been taken, so this only has an
   * effect where `playing` never arrived — a browser that gave us no event, or a voice whose
   * audio reached the speaker some other way.
   */
  it('closes the audible welcome when the worker says Aria is speaking', () => {
    const { timings, reporter } = build();

    timings.agentState('speaking');

    expect(reporter.stop).toHaveBeenCalledWith('audible_welcome');
  });

  it.each(['listening', 'thinking'] as const)(
    'closes the interrupt bar when Aria is %s rather than speaking',
    (state) => {
      const { timings, reporter } = build();

      timings.agentState(state);

      expect(reporter.stop).toHaveBeenCalledWith('interrupt_silence');
    },
  );

  it('abandons every measurement in flight when the room goes away', () => {
    const { timings, reporter } = build();

    timings.disconnected();

    expect(reporter.cancel.mock.calls.flat()).toEqual([
      'audio_unlocked',
      'audible_welcome',
      'interrupt_silence',
    ]);
  });

  it('binds and unbinds the session the reports name', () => {
    const { timings, reporter } = build();

    timings.bind('session-1');
    timings.bind(null);

    expect(reporter.bind.mock.calls.flat()).toEqual(['session-1', null]);
  });

  /**
   * A scripted scenario has no worker and no speaker, so it is given no reporter. Nothing here
   * may throw in that case: a fixture must not be able to break the page it is demonstrating.
   */
  it('does nothing at all without a reporter', () => {
    const timings = createVoiceTimings();
    const element = new EventTarget() as HTMLMediaElement;

    expect(() => {
      timings.bind('session-1');
      timings.roomConnected();
      timings.watchAudioElement(element);
      element.dispatchEvent(new Event('playing'));
      timings.agentState('speaking');
      timings.disconnected();
    }).not.toThrow();
  });
});

function build() {
  const reporter = {
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    bind: vi.fn(),
    flush: vi.fn(() => Promise.resolve()),
  };
  const port: TurnTimingReporter = reporter;
  return { timings: createVoiceTimings(port), reporter };
}
