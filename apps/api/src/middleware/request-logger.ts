import { pinoHttp } from 'pino-http';

import type { Logger } from '@/lib/logger';

import type { RequestHandler } from 'express';

/**
 * One structured line per request, correlated by request id.
 *
 * Bodies are never logged. The redaction list in `lib/logger.ts` is the backstop; not
 * serialising the body in the first place is the actual protection (CODE-STANDARDS §5).
 */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (_req, res, err) => {
      if (err !== undefined || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
