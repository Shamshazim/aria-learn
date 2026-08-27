import type { TutorInputEvent } from '@aria/shared';

import {
  ContentUnavailableError,
  type TutorOutput,
  type TutorSource,
} from '@/features/session/model/tutor-source';
import { createScriptedSource } from '@/features/session/sources/scripted-source';

/** Scripted Phase 0 adapter for the typed service_unavailable path; the HTTP adapter replaces it. */
export function createUnavailableOnceSource(): TutorSource {
  const base = createScriptedSource();
  let exhausted = false;
  return {
    send: async function* (event, signal): AsyncIterable<TutorOutput> {
      if (shouldExhaust(event, exhausted)) {
        exhausted = true;
        throw new ContentUnavailableError();
      }
      yield* base.send(event, signal);
    },
    close: () => {
      base.close();
    },
  };
}

function shouldExhaust(event: TutorInputEvent, exhausted: boolean): boolean {
  return !exhausted && event.kind === 'ANSWER' && event.text === '7';
}
