import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, type Express } from 'express';
import helmet from 'helmet';

import type { AppConfig } from '@/config';
import { createHealthController } from '@/controllers/health.controller';
import { createStatusController } from '@/controllers/status.controller';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import { errorHandler } from '@/middleware/error-handler';
import { notFound } from '@/middleware/not-found';
import { operatorOnly } from '@/middleware/operator-only';
import { requestId } from '@/middleware/request-id';
import { requestLogger } from '@/middleware/request-logger';
import { API_PREFIX, createApiRouter } from '@/routes';
import type { RouterDeps } from '@/routes';
import { createHealthService } from '@/services/health.service';
import type { StatusService } from '@/services/status.service';

/**
 * The composition root: it wires dependencies and middleware, and contains no business logic.
 *
 * It exports the app without listening, which is what makes supertest possible —
 * `server.ts` owns the socket (CODE-STANDARDS §3.1).
 */
export type AppDeps = {
  config: AppConfig;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  statusService?: StatusService;
  /** P2H-12: parent sign-in and the child picker. Absent where no project is configured. */
  identity?: RouterDeps['identity'];
  student?: RouterDeps['student'];
  voice?: RouterDeps['voice'];
};

export function createApp({
  config,
  logger,
  clock,
  ids,
  statusService,
  identity,
  student,
  voice,
}: AppDeps): Express {
  const app = express();

  // Order matters. A request gets its id before anything can log it, and the error handler
  // is last so every layer above can throw into it.
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
      credentials: true,
    }),
  );
  app.use(json({ limit: config.jsonBodyLimit }));
  // P2H-12: the child session travels in a signed cookie. Without a secret nothing can be
  // signed, so `signedCookies` stays empty and every student route refuses — which is the
  // right behaviour for a deployment that has not been given one.
  app.use(cookieParser(config.auth?.childSessionSecret));
  app.use(requestId(ids));
  app.use(requestLogger(logger));

  app.use(
    API_PREFIX,
    createApiRouter({
      healthController: buildHealthController({ config, clock }),
      ...(statusService === undefined || config.statusOperatorToken === undefined
        ? {}
        : {
            status: {
              controller: createStatusController(statusService),
              authorize: operatorOnly(config.statusOperatorToken),
            },
          }),
      ...(identity === undefined ? {} : { identity }),
      ...(student === undefined ? {} : { student }),
      ...(voice === undefined ? {} : { voice }),
    }),
  );

  app.use(notFound());
  app.use(errorHandler());

  return app;
}

/**
 * Kept separate so `createApp` stays a list of middleware rather than a mix of wiring and
 * construction. Later tickets add their own builders beside this one.
 */
function buildHealthController({ config, clock }: Pick<AppDeps, 'config' | 'clock'>) {
  return createHealthController(
    createHealthService({ clock, startedAt: clock.now(), version: config.version }),
  );
}
