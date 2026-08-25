import { Router } from 'express';

import type { VoiceControllers } from '@/controllers/voice.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import {
  realtimeParamsSchema,
  voiceConsentSchema,
  voiceConsentWithdrawSchema,
  workerVoiceMetricSchema,
  workerVoiceTurnSchema,
} from '@/schemas/voice.schema';

import type { RequestHandler } from 'express';

export function createVoiceStudentRouter(
  input: Readonly<{
    authorize: RequestHandler;
    controller: VoiceControllers;
  }>,
): Router {
  const router = Router();
  router.post(
    '/student/session/:id/realtime',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    asyncHandler(input.controller.realtime),
  );
  return router;
}

export function createVoiceWorkerRouter(
  input: Readonly<{
    authorize: RequestHandler;
    controller: VoiceControllers;
  }>,
): Router {
  const router = Router();
  router.post(
    '/internal/voice/session/:id/turn',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    validate(workerVoiceTurnSchema, 'body'),
    asyncHandler(input.controller.workerTurn),
  );
  router.post(
    '/internal/voice/session/:id/metrics',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    validate(workerVoiceMetricSchema, 'body'),
    asyncHandler(input.controller.workerMetric),
  );
  return router;
}

export function createVoiceAdminRouter(
  input: Readonly<{
    authorize: RequestHandler;
    controller: VoiceControllers;
  }>,
): Router {
  const router = Router();
  router.post(
    '/operator/voice-consent',
    input.authorize,
    validate(voiceConsentSchema, 'body'),
    asyncHandler(input.controller.grantConsent),
  );
  router.post(
    '/operator/voice-consent/withdraw',
    input.authorize,
    validate(voiceConsentWithdrawSchema, 'body'),
    asyncHandler(input.controller.withdrawConsent),
  );
  return router;
}
