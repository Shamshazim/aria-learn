import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';

export type MoveFactory = Readonly<{
  make(input: Readonly<Record<string, unknown>>): TutorMove;
}>;

export function createMoveFactory(deps: {
  ids: IdGenerator;
  clock: Clock;
  sessionId?: string;
}): MoveFactory {
  return {
    make: (input) =>
      tutorMoveSchema.parse({
        id: deps.ids.next(),
        at: deps.clock.now().toISOString(),
        protocolVersion: PROTOCOL_VERSION,
        display: [],
        expects: 'none',
        speech: null,
        ...(deps.sessionId === undefined ? {} : { sessionId: deps.sessionId }),
        ...input,
      }),
  };
}
