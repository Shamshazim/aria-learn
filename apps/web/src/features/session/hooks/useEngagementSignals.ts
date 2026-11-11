import { useEffect, useRef } from 'react';

import { IDLE_MS, TAB_HIDDEN_MIN_MS } from '@aria/tutor';

import type { EventPayload } from '@/features/session/model/input-events';

/**
 * The two engagement signals only a browser can see (P3-05): the tab was hidden, or the child
 * walked away from it.
 *
 * Hidden for thirty seconds is `idle`, sent at the thirty-second mark so whatever Aria asks is
 * waiting when the child comes back. Hidden for less, but long enough not to be a notification
 * banner, is `tab_hidden`, sent on return. Under three seconds is nothing. The thresholds are
 * `@aria/tutor`'s, so the browser and the estimator cannot disagree about what counts.
 *
 * No camera, no microphone, no keystroke timing: visibility is the whole of it.
 */
export function useEngagementSignals(send: (payload: EventPayload) => Promise<void>): void {
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    let hiddenAt: number | null = document.hidden ? Date.now() : null;
    let idleTimer: number | undefined;
    let idleSent = false;
    const report = (signal: 'tab_hidden' | 'idle', hiddenMs: number): void => {
      void sendRef.current({ kind: 'ENGAGEMENT_SIGNAL', signal, hiddenMs });
    };
    const onChange = (): void => {
      if (document.hidden) {
        hiddenAt = Date.now();
        idleSent = false;
        idleTimer = window.setTimeout(() => {
          idleSent = true;
          report('idle', IDLE_MS);
        }, IDLE_MS);
        return;
      }
      window.clearTimeout(idleTimer);
      const hiddenMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (!idleSent && hiddenMs >= TAB_HIDDEN_MIN_MS) report('tab_hidden', hiddenMs);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => {
      window.clearTimeout(idleTimer);
      document.removeEventListener('visibilitychange', onChange);
    };
  }, []);
}
