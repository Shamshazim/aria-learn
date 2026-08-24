import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { Grade } from '@aria/shared';

import { createEventFactory, type EventPayload } from '@/features/session/model/input-events';
import { reduceSession } from '@/features/session/model/session-machine';
import { initialSessionState, type SessionState } from '@/features/session/model/session-state';
import type { TutorSource } from '@/features/session/model/tutor-source';

export type TutorSession = Readonly<{
  state: SessionState;
  send(payload: EventPayload): Promise<void>;
  interrupt(): Promise<void>;
}>;

export function useTutorSession(input: {
  band: SessionState['band'];
  grade: Grade;
  subjectId: string;
  createSource: () => TutorSource;
}): TutorSession {
  const [state, dispatch] = useReducer(reduceSession, input.band, initialSessionState);
  const source = useRef<TutorSource | null>(null);
  const active = useRef<AbortController | null>(null);
  const counter = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const events = useRef(createWebEventFactory(counter));

  const send = useCallback(async (payload: EventPayload): Promise<void> => {
    const currentSource = source.current;
    if (currentSource === null) return;
    const controller = new AbortController();
    active.current = controller;
    for await (const move of currentSource.send(events.current(payload), controller.signal)) {
      dispatch(move);
    }
    if (active.current === controller) active.current = null;
  }, []);

  const createSource = input.createSource;
  useEffect(() => {
    const currentSource = createSource();
    source.current = currentSource;
    void send({ kind: 'ARRIVED', grade: input.grade }).then(() =>
      send({
        kind: 'SUBJECT_CHOSEN',
        subjectId: input.subjectId,
        grade: input.grade,
        fromRecommendation: false,
      }),
    );
    return () => {
      active.current?.abort();
      currentSource.close();
      if (source.current === currentSource) source.current = null;
    };
  }, [createSource, input.grade, input.subjectId, send]);

  const interrupt = useCallback(async (): Promise<void> => {
    const interruptedMoveId = stateRef.current.currentMove?.id;
    active.current?.abort();
    dispatch({ kind: 'STOP_ACTIVE' });
    await send({
      kind: 'INTERRUPT',
      ...(interruptedMoveId === undefined ? {} : { interruptedMoveId }),
    });
  }, [send]);

  return { state, send, interrupt };
}

function createWebEventFactory(
  counter: React.RefObject<number>,
): ReturnType<typeof createEventFactory> {
  const eventCounter = counter;
  return createEventFactory({
    nextId: () => {
      eventCounter.current += 1;
      return `web-event-${String(eventCounter.current)}`;
    },
    now: () => new Date(),
  });
}
