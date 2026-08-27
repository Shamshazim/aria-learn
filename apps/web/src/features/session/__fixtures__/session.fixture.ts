import type { TutorSession } from '@/features/session/model/session-commands';
import { initialSessionState, type SessionState } from '@/features/session/model/session-state';

/**
 * A session object with every command present and doing nothing.
 *
 * Built whole rather than cast from a partial: the type is the list of things a layout may
 * call, and a cast would let a layout start calling something the fixture never had.
 */
export function stubSession(state: Partial<SessionState> = {}): TutorSession {
  const nothing = (): Promise<void> => Promise.resolve();
  return {
    state: { ...initialSessionState('early'), status: 'listening', ...state },
    connectionStatus: 'online',
    answer: nothing,
    askQuestion: nothing,
    backchannel: nothing,
    speechPartial: nothing,
    confused: nothing,
    completeDrag: nothing,
    interrupt: nothing,
    leave: nothing,
    pause: nothing,
    resume: nothing,
    speak: nothing,
    receive: () => undefined,
  };
}
