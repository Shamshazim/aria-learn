import { describe, expect, it } from 'vitest';

import { adultAuthReducer, initialAdultAuthState, type AdultAuthState } from './adult-auth.machine';

import type { AdultAuthResponse } from '../api/adult-auth.api';

const ADULT: AdultAuthResponse = {
  adultId: 'adult-1',
  role: 'parent',
  parentId: 'parent-1',
  sessionId: 'session-1',
};

function reduce(state: AdultAuthState, ...events: Parameters<typeof adultAuthReducer>[1][]) {
  return events.reduce(adultAuthReducer, state);
}

describe('adultAuthReducer', () => {
  it('starts by checking a stored token rather than assuming signed out', () => {
    expect(initialAdultAuthState.status).toBe('checking');
  });

  it('walks the email path from request to sent', () => {
    const state = reduce(
      initialAdultAuthState,
      { type: 'no_session' },
      { type: 'link_requested', email: 'parent@example.test' },
      { type: 'link_sent' },
    );

    expect(state).toEqual({ status: 'link_sent', email: 'parent@example.test' });
  });

  it('takes a returning token over whatever was on screen', () => {
    const state = reduce(
      initialAdultAuthState,
      { type: 'link_requested', email: 'parent@example.test' },
      { type: 'token_returned', accessToken: 'provider-token' },
    );

    expect(state).toEqual({
      status: 'attesting',
      accessToken: 'provider-token',
      submitting: false,
    });
  });

  it('drops the token when the server refuses the attestation', () => {
    const state = reduce(
      initialAdultAuthState,
      { type: 'token_returned', accessToken: 'provider-token' },
      { type: 'attested' },
      { type: 'sign_in_failed', problem: 'not_an_adult' },
    );

    expect(state).toEqual({ status: 'signed_out', problem: 'not_an_adult' });
    expect(JSON.stringify(state)).not.toContain('provider-token');
  });

  it('reports an expired link as a problem rather than as a blank screen', () => {
    expect(reduce(initialAdultAuthState, { type: 'link_rejected' })).toEqual({
      status: 'signed_out',
      problem: 'link_expired',
    });
  });

  it('ignores a sent confirmation that does not belong to a request in flight', () => {
    const signedOut = reduce(initialAdultAuthState, { type: 'no_session' });

    expect(reduce(signedOut, { type: 'link_sent' })).toBe(signedOut);
  });

  it('signs out from anywhere', () => {
    const state = reduce(initialAdultAuthState, { type: 'restored', adult: ADULT });

    expect(reduce(state, { type: 'signed_out' })).toEqual({
      status: 'signed_out',
      problem: null,
    });
  });
});
