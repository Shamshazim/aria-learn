import { SECRET_PICTURE_LENGTH } from '@aria/shared';
import type { PictureSecret, SecretPictureKey } from '@aria/shared';

import type { ChildProfile } from '../api/child-auth.api';

/**
 * The child sign-in flow as a pure reducer, so the sequencing can be tested without rendering
 * anything (§3.2). The components below it only draw a state and raise an event.
 *
 * The states are the four things a child can be looking at: waiting for the device to be
 * recognised, choosing their own picture, tapping their secret, or being told to fetch a
 * grown-up. Nothing else is a state — "wrong pictures" is not, because a child who taps wrong
 * should land back on a cleared pad rather than in an error screen they have to dismiss.
 */
export type SignInState =
  | Readonly<{ status: 'loading' }>
  /** No device grant on this device, or the parent revoked it. Only an adult can fix this. */
  | Readonly<{ status: 'needs_device' }>
  | Readonly<{ status: 'choosing'; profiles: readonly ChildProfile[] }>
  | Readonly<{
      status: 'secret';
      profiles: readonly ChildProfile[];
      profile: ChildProfile;
      taps: readonly SecretPictureKey[];
      /** Set after a wrong sequence, so the pad can say "try again" without changing state. */
      retry: boolean;
      submitting: boolean;
    }>
  /** Too many wrong tries. `seconds` is what the screen counts down. */
  | Readonly<{ status: 'locked'; profile: ChildProfile; seconds: number }>
  | Readonly<{ status: 'ready'; profile: ChildProfile }>;

export type SignInEvent =
  | Readonly<{ type: 'device_missing' }>
  | Readonly<{ type: 'profiles_loaded'; profiles: readonly ChildProfile[] }>
  | Readonly<{ type: 'profile_chosen'; studentId: string }>
  | Readonly<{ type: 'tapped'; picture: SecretPictureKey }>
  | Readonly<{ type: 'undo' }>
  | Readonly<{ type: 'submitting' }>
  | Readonly<{ type: 'wrong_secret' }>
  | Readonly<{ type: 'locked_out'; seconds: number }>
  | Readonly<{ type: 'opened' }>
  | Readonly<{ type: 'back' }>;

export const initialSignInState: SignInState = { status: 'loading' };

export function signInReducer(state: SignInState, event: SignInEvent): SignInState {
  switch (event.type) {
    case 'device_missing':
      return { status: 'needs_device' };

    case 'profiles_loaded':
      return event.profiles.length === 0
        ? { status: 'needs_device' }
        : { status: 'choosing', profiles: event.profiles };

    case 'profile_chosen':
      return chooseProfile(state, event.studentId);

    case 'back':
      return goBack(state);

    default:
      // Everything else only means something while a secret is being tapped, and is ignored
      // anywhere else — a late reply from an abandoned attempt must not move the screen.
      return state.status === 'secret' ? onSecret(state, event) : state;
  }
}

type SecretState = Extract<SignInState, { status: 'secret' }>;

function onSecret(
  state: SecretState,
  event: Extract<
    SignInEvent,
    { type: 'tapped' | 'undo' | 'submitting' | 'wrong_secret' | 'locked_out' | 'opened' }
  >,
): SignInState {
  switch (event.type) {
    case 'tapped':
      return tap(state, event.picture);

    case 'undo':
      return state.submitting ? state : { ...state, taps: state.taps.slice(0, -1), retry: false };

    case 'submitting':
      return { ...state, submitting: true };

    // The taps are cleared, not kept for correcting: a child cannot tell which of four was
    // wrong, and a half-remembered sequence is what makes them run out of attempts.
    case 'wrong_secret':
      return { ...state, taps: [], retry: true, submitting: false };

    case 'locked_out':
      return { status: 'locked', profile: state.profile, seconds: event.seconds };

    case 'opened':
      return { status: 'ready', profile: state.profile };
  }
}

function chooseProfile(state: SignInState, studentId: string): SignInState {
  if (state.status !== 'choosing') return state;

  const profile = state.profiles.find((item) => item.studentId === studentId);
  if (profile === undefined) return state;

  return {
    status: 'secret',
    profiles: state.profiles,
    profile,
    taps: [],
    retry: false,
    submitting: false,
  };
}

function tap(state: SecretState, picture: SecretPictureKey): SignInState {
  if (state.submitting || state.taps.length >= SECRET_PICTURE_LENGTH) return state;
  return { ...state, taps: [...state.taps, picture], retry: false };
}

function goBack(state: SignInState): SignInState {
  if (state.status === 'secret') return { status: 'choosing', profiles: state.profiles };
  if (state.status === 'locked') return { status: 'loading' };
  return state;
}

/** The four taps, once there are four. The hook submits exactly when this stops being null. */
export function completedSecret(state: SignInState): PictureSecret | null {
  if (state.status !== 'secret' || state.submitting) return null;
  return state.taps.length === SECRET_PICTURE_LENGTH ? state.taps : null;
}
