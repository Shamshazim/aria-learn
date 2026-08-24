export type ApiErrorKind = 'aborted' | 'http' | 'malformed' | 'network' | 'timeout';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly code: string,
    readonly status?: number,
  ) {
    super(safeMessage(kind));
    this.name = 'ApiError';
  }
}

function safeMessage(kind: ApiErrorKind): string {
  if (kind === 'timeout') return 'Aria took too long to answer. Please try again.';
  if (kind === 'aborted') return 'That request was stopped.';
  return 'Aria could not connect. Please try again.';
}
