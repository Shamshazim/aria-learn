/**
 * Every error the API can return, as a stable machine-readable code.
 *
 * Clients branch on the code, never on the message: the message is for a human reading a log
 * and may be reworded at any time. Codes are added here and nowhere else, so the full set of
 * failures the API can express is one file long.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  /** P2H-12: nobody is signed in, or the proof they offered did not check out. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  /**
   * P0-28: the parent is signed in, but has not given verifiable consent yet. Its own code
   * because the parent app answers it with a specific screen — the consent flow — and
   * "you cannot access that" is neither true nor actionable here.
   */
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  /**
   * P2H-12: too many wrong PINs. Its own code because the child screen shows one fixed
   * sentence for it — "Ask a grown-up" — and must not be able to show a countdown.
   */
  LOCKED: 'LOCKED',
  /** The request was well formed but conflicts with what is already stored (P0-04). */
  CONFLICT: 'CONFLICT',
  /**
   * X-05: the actor has spent its budget for this route class.
   *
   * Its own code because the child UI must never render it as a number. The web app maps
   * this to the P0-25 calm screen for the length of the window; a child who taps twice too
   * fast is not told off, and never sees "429".
   */
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
