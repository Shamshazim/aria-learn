import { createContext } from 'react';

import type { ChildPicture } from '@aria/shared';

import { INITIAL_AUTH_STATE, type AuthState } from '@/features/auth/model/auth.machine';

/**
 * The one place the rest of the app asks who is using the device (P2H-12).
 *
 * A context rather than props because every screen needs it and none of them owns it — a child
 * session is a property of the device, not of the page that happens to be showing.
 */
export type ChildAttempt = Readonly<{
  childId: string;
  pin?: string;
  pictureSequence?: readonly ChildPicture[];
}>;

export type AuthContextValue = Readonly<{
  state: AuthState;
  signInParent(email: string, password: string): Promise<void>;
  signOutParent(): void;
  signInChild(attempt: ChildAttempt): Promise<void>;
  signOutChild(): Promise<void>;
  /** Rotates the child's cookie and pushes the new deadline back into state. */
  keepAlive(): Promise<void>;
}>;

const unavailable = (): Promise<void> => Promise.reject(new Error('auth provider is missing'));

export const AuthContext = createContext<AuthContextValue>({
  state: INITIAL_AUTH_STATE,
  signInParent: unavailable,
  signOutParent: () => undefined,
  signInChild: unavailable,
  signOutChild: unavailable,
  keepAlive: unavailable,
});
