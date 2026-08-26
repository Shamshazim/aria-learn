import type { AdultAuthResponse, AdultRole } from '../api/adult-auth.api';

/**
 * The grown-up half of P0-28 as a pure reducer.
 *
 * Two entrances lead to the same place. A parent either arrives with nothing and asks for an
 * email, or arrives back from that email carrying a provider token in the URL fragment. Only
 * the second one can sign in, and only after the age gate: the FTC attestation is a
 * precondition of the request that creates the identity, not a checkbox recorded afterwards.
 */
export type AdultAuthState =
  /** A stored token is being checked against the server before anything is drawn. */
  | Readonly<{ status: 'checking' }>
  | Readonly<{ status: 'signed_out'; problem: AdultAuthProblem | null }>
  | Readonly<{ status: 'sending'; email: string }>
  | Readonly<{ status: 'link_sent'; email: string }>
  /** Back from the link, holding a token nothing has been done with yet. */
  | Readonly<{ status: 'attesting'; accessToken: string; submitting: boolean }>
  | Readonly<{ status: 'signed_in'; adult: AdultAuthResponse }>;

/** What went wrong, in terms a screen can phrase. Never the provider's own words. */
export type AdultAuthProblem = 'link_expired' | 'send_failed' | 'sign_in_failed' | 'not_an_adult';

export type AdultAuthEvent =
  | Readonly<{ type: 'restored'; adult: AdultAuthResponse }>
  | Readonly<{ type: 'no_session' }>
  | Readonly<{ type: 'link_requested'; email: string }>
  | Readonly<{ type: 'link_sent' }>
  | Readonly<{ type: 'link_failed' }>
  | Readonly<{ type: 'token_returned'; accessToken: string }>
  | Readonly<{ type: 'link_rejected' }>
  | Readonly<{ type: 'attested' }>
  | Readonly<{ type: 'signed_in'; adult: AdultAuthResponse }>
  | Readonly<{ type: 'sign_in_failed'; problem: AdultAuthProblem }>
  | Readonly<{ type: 'signed_out' }>;

export const initialAdultAuthState: AdultAuthState = { status: 'checking' };

const SIGNED_OUT: AdultAuthState = { status: 'signed_out', problem: null };

export function adultAuthReducer(state: AdultAuthState, event: AdultAuthEvent): AdultAuthState {
  switch (event.type) {
    case 'restored':
    case 'signed_in':
      return { status: 'signed_in', adult: event.adult };

    case 'link_requested':
      return { status: 'sending', email: event.email };

    case 'link_sent':
      return state.status === 'sending' ? { status: 'link_sent', email: state.email } : state;

    // A returning token outranks whatever the screen was showing: the parent just clicked the
    // link, and asking them to click something else first would be absurd.
    case 'token_returned':
      return { status: 'attesting', accessToken: event.accessToken, submitting: false };

    case 'attested':
      return state.status === 'attesting' ? { ...state, submitting: true } : state;

    default:
      return signedOut(event);
  }
}

/**
 * Every way this flow ends up signed out, and why.
 *
 * The token is dropped along with the state in each of them: an attestation the server refused
 * must be made again from the beginning, not retried against a token the screen still holds.
 */
function signedOut(
  event: Extract<
    AdultAuthEvent,
    { type: 'no_session' | 'signed_out' | 'link_failed' | 'link_rejected' | 'sign_in_failed' }
  >,
): AdultAuthState {
  switch (event.type) {
    case 'link_failed':
      return { status: 'signed_out', problem: 'send_failed' };
    case 'link_rejected':
      return { status: 'signed_out', problem: 'link_expired' };
    case 'sign_in_failed':
      return { status: 'signed_out', problem: event.problem };
    default:
      return SIGNED_OUT;
  }
}

/** The one field the age gate collects beyond the tick itself. */
export const ADULT_ROLES: readonly AdultRole[] = ['parent', 'teacher'];
