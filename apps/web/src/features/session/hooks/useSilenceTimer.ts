import { useCallback, useEffect, useRef, useState } from 'react';

import type { Band, TutorMove } from '@aria/shared';
import { shouldArmSilenceTimer, silenceWindowMs } from '@aria/tutor';

/**
 * The silence countdown (P2H-01).
 *
 * Two child sounds mean different things, so they do different things here. A backchannel
 * ("mm-hm") tells us the child is present but has nothing to add — cancel the countdown and
 * do not nag, but do not pretend they answered either. A partial transcript means they are
 * mid-sentence — give them the full window again to finish it.
 *
 * The arming rule itself lives in `@aria/tutor` so the voice worker cannot drift from the UI.
 */
export type SilenceControls = Readonly<{
  backchannel: () => void;
  speechPartial: () => void;
}>;

export function useSilenceTimer(input: {
  move: TutorMove | null;
  band: Band;
  speaking: boolean;
  onSilence: (payload: Readonly<{ waitedMs: number; afterMoveId: string }>) => void;
}): SilenceControls {
  const attended = useDocumentVisible();
  const [restarts, setRestarts] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const onSilence = useRef(input.onSilence);
  onSilence.current = input.onSilence;
  const move = input.move;

  // A new move is a fresh countdown, whatever a backchannel did to the previous one.
  useEffect(() => {
    setCancelled(false);
  }, [move]);

  useEffect(() => {
    if (cancelled) return;
    if (!shouldArmSilenceTimer({ move, speaking: input.speaking, attended })) return;
    const moveId = move?.id;
    if (moveId === undefined) return;
    const waitedMs = silenceWindowMs(input.band);
    const timer = window.setTimeout(() => {
      onSilence.current({ waitedMs, afterMoveId: moveId });
    }, waitedMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [attended, cancelled, input.band, input.speaking, move, restarts]);

  return {
    backchannel: useCallback(() => {
      setCancelled(true);
    }, []),
    speechPartial: useCallback(() => {
      setCancelled(false);
      setRestarts((count) => count + 1);
    }, []),
  };
}

/** `false` while the tab is backgrounded: a child who walked away is not being ignored. */
function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = (): void => {
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return visible;
}
