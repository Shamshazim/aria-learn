import { Router, type RequestHandler } from 'express';

import type { StatusController } from '@/controllers/status.controller';
import { asyncHandler } from '@/middleware/async-handler';

export function createStatusRouter(
  controller: StatusController,
  authorize: RequestHandler,
): Router {
  const router = Router();
  router.get('/status', authorize, asyncHandler(controller.get));
  return router;
}
