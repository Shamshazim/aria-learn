import { useEffect } from 'react';

import type { Grade, TutorMove } from '@aria/shared';

import type { EventPayload } from '@/features/session/model/input-events';
import type { SessionState } from '@/features/session/model/session-state';
import type { TutorSource } from '@/features/session/model/tutor-source';

type Send = (payload: EventPayload) => Promise<void>;

type LifecycleInput = Readonly<{
  band: SessionState['band'];
  grade: Grade;
  subjectId: string;
  createSource: () => TutorSource;
  startupEvents?: readonly EventPayload[];
  onSpeak?: () => Promise<void>;
  onMove?: (move: TutorMove) => void;
}>;

/** The source's life: created with the session, played its startup, closed with the session. */
export function useSourceLifecycle(
  input: LifecycleInput,
  source: React.RefObject<TutorSource | null>,
  active: React.RefObject<AbortController | null>,
  send: Send,
): void {
  const createSource = input.createSource;
  const sourceRef = source;
  useEffect(() => {
    const currentSource = createSource();
    const lifecycle = new AbortController();
    sourceRef.current = currentSource;
    void playStartup(input, send, lifecycle.signal);
    return () => {
      lifecycle.abort();
      active.current?.abort();
      currentSource.close();
      if (sourceRef.current === currentSource) sourceRef.current = null;
    };
  }, [active, createSource, input.grade, input.startupEvents, input.subjectId, send, sourceRef]);
}

async function playStartup(input: LifecycleInput, send: Send, signal: AbortSignal): Promise<void> {
  if (input.startupEvents !== undefined) {
    for (const event of input.startupEvents) {
      if (signal.aborted) return;
      await send(event);
    }
    return;
  }
  await send({ kind: 'ARRIVED', grade: input.grade });
  if (signal.aborted) return;
  await send({
    kind: 'SUBJECT_CHOSEN',
    subjectId: input.subjectId,
    grade: input.grade,
    fromRecommendation: false,
  });
}

export function useMediaEvents(send: Send, retry: () => Promise<void>): void {
  useEffect(() => {
    const lost = (): void => {
      void send({ kind: 'MEDIA_LOST' });
    };
    const restored = (): void => {
      void send({ kind: 'MEDIA_RESTORED' }).then(retry);
    };
    window.addEventListener('offline', lost);
    window.addEventListener('online', restored);
    return () => {
      window.removeEventListener('offline', lost);
      window.removeEventListener('online', restored);
    };
  }, [retry, send]);
}
