import type { Band, TutorMove } from '@aria/shared';
import { shouldArmSilenceTimer, silenceWindowMs } from '@aria/tutor';

/**
 * The voice channel's half of the silence countdown (P2H-01).
 *
 * The arming rule and the window come from `@aria/tutor`, the same two functions the browser
 * uses, so a child who goes quiet on a tablet and a child who goes quiet in a room get the
 * same tutor. What differs is only what "attended" and "speaking" mean here: the room is
 * attended until the participant leaves, and Aria is speaking whenever the agent session says
 * she is.
 *
 * The scheduler is injected because a test that waits twelve real seconds is a test nobody runs.
 */
export type Scheduler = Readonly<{
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}>;

export type SilenceTimer = Readonly<{
  /** A move was published. Arms the countdown unless the move hands the floor over. */
  armFor(move: TutorMove): void;
  /** Aria started or stopped talking. */
  speaking(isSpeaking: boolean): void;
  /** A sound that said "still here": stop nudging, but do not treat it as an answer. */
  backchannel(): void;
  /** The child is mid-sentence: give them the whole window again. */
  speechPartial(): void;
  /** The room closed. */
  stop(): void;
}>;

export const systemScheduler: Scheduler = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

export function createSilenceTimer(input: {
  band: Band;
  onSilence(payload: Readonly<{ waitedMs: number; afterMoveId: string }>): void;
  scheduler?: Scheduler;
}): SilenceTimer {
  const scheduler = input.scheduler ?? systemScheduler;
  const waitedMs = silenceWindowMs(input.band);
  let handle: unknown = null;
  let move: TutorMove | null = null;
  let speaking = false;
  let cancelled = false;
  let stopped = false;

  const disarm = (): void => {
    if (handle === null) return;
    scheduler.clear(handle);
    handle = null;
  };

  const reconsider = (): void => {
    disarm();
    if (stopped || cancelled) return;
    if (!shouldArmSilenceTimer({ move, speaking, attended: true })) return;
    const afterMoveId = move?.id;
    if (afterMoveId === undefined) return;
    handle = scheduler.set(() => {
      handle = null;
      input.onSilence({ waitedMs, afterMoveId });
    }, waitedMs);
  };

  return {
    armFor: (published) => {
      move = published;
      cancelled = false;
      reconsider();
    },
    speaking: (isSpeaking) => {
      speaking = isSpeaking;
      reconsider();
    },
    backchannel: () => {
      cancelled = true;
      disarm();
    },
    speechPartial: () => {
      cancelled = false;
      reconsider();
    },
    stop: () => {
      stopped = true;
      disarm();
    },
  };
}
