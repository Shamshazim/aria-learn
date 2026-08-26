import { useEffect, useRef, useState } from 'react';

import { idleStatus, shouldKeepAlive, type IdleStatus } from '@/features/auth/model/idle-timer';

/**
 * Watches the idle deadline, and tells the server when the device is actually being used
 * (P2H-12).
 *
 * Two halves. A tick works out whether to warn; a set of activity listeners decides when to
 * send a keep-alive, throttled hard, because every one of them rotates a cookie. Neither half
 * decides whether the session is over — the server does, and a keep-alive that comes back
 * empty is how this device finds out.
 */
const TICK_MS = 15_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;

export function useIdleWatch(
  deadline: Date | null,
  keepAlive: () => Promise<void>,
  now: () => Date = () => new Date(),
): IdleStatus {
  const [status, setStatus] = useState<IdleStatus>('active');
  const lastSentAt = useRef<Date | null>(null);

  useEffect(() => {
    if (deadline === null) {
      setStatus('active');
      return;
    }
    setStatus(idleStatus(deadline, now()));
    const timer = window.setInterval(() => {
      setStatus(idleStatus(deadline, now()));
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [deadline, now]);

  useEffect(() => {
    if (deadline === null) return;
    const onActivity = (): void => {
      const at = now();
      if (!shouldKeepAlive(lastSentAt.current, at)) return;
      lastSentAt.current = at;
      void keepAlive();
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity);
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [deadline, keepAlive, now]);

  // Past the deadline the server has already ended it; asking is how this device learns that
  // and lands back on the picker instead of showing a screen whose every request will fail.
  useEffect(() => {
    if (status !== 'expired') return;
    void keepAlive();
  }, [keepAlive, status]);

  return status;
}
