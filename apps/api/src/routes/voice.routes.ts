import { Router } from 'express';

import type { VoiceBridgeControllers } from '@/controllers/voice-bridge.controller';
import type { VoiceControllers } from '@/controllers/voice.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import {
  bridgeAudioParamsSchema,
  bridgeLibraryQuerySchema,
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
    /** P2H-09: absent in a deployment that has recorded no bridge clips. */
    bridges?: VoiceBridgeControllers;
  }>,
): Router {
  const router = Router();
  const bridges = input.bridges;
  if (bridges !== undefined) {
    router.get(
      '/internal/voice/bridges',
      input.authorize,
      validate(bridgeLibraryQuerySchema, 'query'),
      asyncHandler(bridges.library),
    );
    router.get(
      '/internal/voice/bridges/:assetId/audio',
      input.authorize,
      validate(bridgeAudioParamsSchema, 'params'),
      asyncHandler(bridges.audio),
    );
  }
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
