import type { ErrorCode } from '@/errors';
import type { Logger } from '@/lib/logger';

import type { Request } from 'express';

/**
 * The HTTP vocabulary shared by every controller. Declarations only — no behaviour.
 */

/** The single error body the API ever returns (CODE-STANDARDS §5). */
export type ApiError = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
};

/** The success envelope. `data` is the resource; metadata never leaks into it. */
export type ApiResponse<T> = {
  data: T;
};

/**
 * A request whose validated input is typed.
 *
 * `validate()` middleware parses into these fields, so a controller reads typed input and
 * never re-parses or asserts. The raw Express `body` stays untouched and unused.
 */
export type TypedRequest<TBody = unknown, TQuery = unknown, TParams = unknown> = Request & {
  validated: {
    body: TBody;
    query: TQuery;
    params: TParams;
  };
};

declare module 'express-serve-static-core' {
  /**
   * Declaration merging is the only way to add per-request fields to Express, so `interface`
   * is deliberate here — the one case CODE-STANDARDS §1 allows it.
   */
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    /** Correlation id for this request; echoed as `x-request-id` and on every log line. */
    id: string;
    /** A child logger already bound to this request's id. */
    log: Logger;
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}
