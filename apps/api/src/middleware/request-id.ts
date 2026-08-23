import type { IdGenerator } from '@/lib/ids';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** The header a caller may set to join an existing trace, and the one we always echo. */
export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_INBOUND_ID_LENGTH = 128;
const SAFE_ID = /^[\w.:-]+$/;

/**
 * Gives every request a correlation id and echoes it back.
 *
 * An inbound id is accepted so a trace can span services, but only after it is bounded and
 * character-checked: an unvalidated header value ends up in log lines and response headers,
 * and neither should be able to carry a newline or a megabyte.
 */
export function requestId(ids: IdGenerator): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const inbound = req.get(REQUEST_ID_HEADER);
    const usable =
      inbound !== undefined && inbound.length <= MAX_INBOUND_ID_LENGTH && SAFE_ID.test(inbound);

    req.id = usable ? inbound : ids.next();
    res.setHeader(REQUEST_ID_HEADER, req.id);
    next();
  };
}
