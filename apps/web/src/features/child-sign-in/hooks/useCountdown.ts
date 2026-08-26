import { useEffect, useState } from 'react';

/**
 * Counts a lockout down to zero, once per second.
 *
 * Purely presentational: the server owns the real lock and will refuse an early attempt
 * anyway. This exists so a waiting child sees a number that moves instead of a screen that
 * looks broken.
 */
export function useCountdown(seconds: number, onDone?: () => void): number {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onDone?.();
      return;
    }
    const timer = window.setTimeout(() => {
      setRemaining((value) => value - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [remaining, onDone]);

  return remaining;
}

/** `4:05`, because a lockout is minutes long and a bare 245 means nothing to anyone. */
export function formatWait(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes)}:${String(safe % 60).padStart(2, '0')}`;
}
