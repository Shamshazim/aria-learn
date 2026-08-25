import { describe, expect, it, vi } from 'vitest';

import type { TutorMove } from '@aria/shared';
import { silenceWindowMs } from '@aria/tutor';

import { createSilenceTimer, type Scheduler } from '@/session/silence-timer';

const WINDOW = silenceWindowMs('early');

function move(kind: TutorMove['kind'], expects: TutorMove['expects'], id = 'move-1'): TutorMove {
  return {
    id,
    at: '2026-08-25T10:00:00.000Z',
    protocolVersion: '1.1.0',
    kind,
    speech: { text: 'What is four plus three?' },
    display: [],
    expects,
  } as TutorMove;
}

/** A scheduler that only fires when the test says so, and only for the live handle. */
function manualScheduler() {
  let next = 0;
  const pending = new Map<number, { callback: () => void; ms: number }>();
  const scheduler: Scheduler = {
    set: (callback, ms) => {
      next += 1;
      pending.set(next, { callback, ms });
      return next;
    },
    clear: (handle) => {
      pending.delete(handle as number);
    },
  };
  return {
    scheduler,
    pendingCount: () => pending.size,
    delays: () => [...pending.values()].map((entry) => entry.ms),
    fire: () => {
      for (const entry of [...pending.values()]) entry.callback();
      pending.clear();
    },
  };
}

function timerFor(kind: TutorMove['kind'] = 'ASK', expects: TutorMove['expects'] = 'text') {
  const clock = manualScheduler();
  const onSilence = vi.fn();
  const timer = createSilenceTimer({ band: 'early', onSilence, scheduler: clock.scheduler });
  timer.armFor(move(kind, expects));
  return { clock, onSilence, timer };
}

describe('worker silence timer', () => {
  it('reports silence after the band window, naming the move it followed', () => {
    const { clock, onSilence } = timerFor();

    expect(clock.delays()).toEqual([WINDOW]);
    clock.fire();

    expect(onSilence).toHaveBeenCalledExactlyOnceWith({
      waitedMs: WINDOW,
      afterMoveId: 'move-1',
    });
  });

  it('never arms on a LISTEN move', () => {
    const { clock, onSilence } = timerFor('LISTEN', 'speech');

    clock.fire();

    expect(clock.pendingCount()).toBe(0);
    expect(onSilence).not.toHaveBeenCalled();
  });

  it('never arms on a move that expects nothing', () => {
    expect(timerFor('SAY', 'none').clock.pendingCount()).toBe(0);
  });

  it('does not run while Aria is speaking, and starts when she stops', () => {
    const { clock, timer, onSilence } = timerFor();

    timer.speaking(true);
    clock.fire();
    expect(onSilence).not.toHaveBeenCalled();

    timer.speaking(false);
    clock.fire();
    expect(onSilence).toHaveBeenCalledOnce();
  });

  it('a backchannel cancels the countdown and does not restart it', () => {
    const { clock, timer, onSilence } = timerFor();

    timer.backchannel();
    clock.fire();

    expect(clock.pendingCount()).toBe(0);
    expect(onSilence).not.toHaveBeenCalled();
  });

  it('a partial transcript restarts the window, and revives it after a backchannel', () => {
    const { clock, timer, onSilence } = timerFor();

    timer.backchannel();
    timer.speechPartial();
    expect(clock.delays()).toEqual([WINDOW]);

    clock.fire();
    expect(onSilence).toHaveBeenCalledOnce();
  });

  it('arms exactly one countdown at a time', () => {
    const { clock, timer } = timerFor();

    timer.speechPartial();
    timer.speechPartial();

    expect(clock.pendingCount()).toBe(1);
  });

  it('stops for good when the room closes', () => {
    const { clock, timer, onSilence } = timerFor();

    timer.stop();
    timer.speechPartial();
    clock.fire();

    expect(onSilence).not.toHaveBeenCalled();
  });
});
