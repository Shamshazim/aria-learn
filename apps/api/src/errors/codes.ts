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
  /** The request was well formed but conflicts with what is already stored (P0-04). */
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
