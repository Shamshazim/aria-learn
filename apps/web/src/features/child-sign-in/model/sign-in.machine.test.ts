import { describe, expect, it } from 'vitest';

import {
  completedSecret,
  initialSignInState,
  signInReducer,
  type SignInEvent,
  type SignInState,
} from './sign-in.machine';

import type { ChildProfile } from '../api/child-auth.api';

/**
 * The sequencing a five-year-old walks through, tested without rendering anything.
 *
 * The cases worth having are the ones that are easy to get wrong in a component and invisible
 * once they are: that a fifth tap does nothing, that a wrong secret clears the pad rather than
 * leaving three taps a child cannot audit, and that nothing at all happens while a submission
 * is in flight — a child taps faster than a network answers.
 */
const PROFILES: readonly ChildProfile[] = [
  { studentId: 'robin', nickname: 'Robin', avatarKey: 'fox' },
  { studentId: 'sam', nickname: 'Sam', avatarKey: 'owl' },
];

function run(events: readonly SignInEvent[], from: SignInState = initialSignInState): SignInState {
  return events.reduce(signInReducer, from);
}

const toSecretPad: readonly SignInEvent[] = [
  { type: 'profiles_loaded', profiles: PROFILES },
  { type: 'profile_chosen', studentId: 'robin' },
];

describe('signInReducer', () => {
  it('starts by loading and offers the granted profiles', () => {
    expect(initialSignInState.status).toBe('loading');
    expect(run([{ type: 'profiles_loaded', profiles: PROFILES }])).toEqual({
      status: 'choosing',
      profiles: PROFILES,
    });
  });

  it('asks for a grown-up when the device has no profiles at all', () => {
    expect(run([{ type: 'profiles_loaded', profiles: [] }]).status).toBe('needs_device');
    expect(run([{ type: 'device_missing' }]).status).toBe('needs_device');
  });

  it('ignores a profile this device was not granted', () => {
    const state = run([
      { type: 'profiles_loaded', profiles: PROFILES },
      { type: 'profile_chosen', studentId: 'someone-elses-child' },
    ]);

    expect(state.status).toBe('choosing');
  });

  it('collects four taps and no more', () => {
    const state = run([
      ...toSecretPad,
      { type: 'tapped', picture: 'apple' },
      { type: 'tapped', picture: 'moon' },
      { type: 'tapped', picture: 'apple' },
      { type: 'tapped', picture: 'kite' },
      { type: 'tapped', picture: 'star' },
    ]);

    expect(state.status === 'secret' && state.taps).toEqual(['apple', 'moon', 'apple', 'kite']);
    expect(completedSecret(state)).toEqual(['apple', 'moon', 'apple', 'kite']);
  });

  it('offers no secret until the fourth tap', () => {
    const state = run([...toSecretPad, { type: 'tapped', picture: 'apple' }]);
    expect(completedSecret(state)).toBeNull();
  });

  it('undoes one tap at a time', () => {
    const state = run([
      ...toSecretPad,
      { type: 'tapped', picture: 'apple' },
      { type: 'tapped', picture: 'moon' },
      { type: 'undo' },
    ]);

    expect(state.status === 'secret' && state.taps).toEqual(['apple']);
  });

  it('clears the pad after a wrong sequence rather than leaving taps to audit', () => {
    const state = run([
      ...toSecretPad,
      { type: 'tapped', picture: 'apple' },
      { type: 'tapped', picture: 'moon' },
      { type: 'tapped', picture: 'star' },
      { type: 'tapped', picture: 'sun' },
      { type: 'submitting' },
      { type: 'wrong_secret' },
    ]);

    expect(state).toMatchObject({ status: 'secret', taps: [], retry: true, submitting: false });
  });

  it('ignores taps while a submission is in flight — a child taps faster than a network', () => {
    const inFlight = run([
      ...toSecretPad,
      { type: 'tapped', picture: 'apple' },
      { type: 'submitting' },
    ]);

    expect(run([{ type: 'tapped', picture: 'moon' }], inFlight)).toEqual(inFlight);
    expect(run([{ type: 'undo' }], inFlight)).toEqual(inFlight);
    expect(completedSecret(inFlight)).toBeNull();
  });

  it('locks with a countdown the screen can show', () => {
    const state = run([...toSecretPad, { type: 'locked_out', seconds: 900 }]);
    expect(state).toEqual({ status: 'locked', profile: PROFILES[0], seconds: 900 });
  });

  it('goes back to the picker from the pad, so a child who tapped the wrong face can escape', () => {
    expect(run([...toSecretPad, { type: 'back' }])).toEqual({
      status: 'choosing',
      profiles: PROFILES,
    });
  });

  it('reaches ready only from the pad', () => {
    expect(run([...toSecretPad, { type: 'opened' }])).toEqual({
      status: 'ready',
      profile: PROFILES[0],
    });
    expect(run([{ type: 'opened' }]).status).toBe('loading');
  });
});
