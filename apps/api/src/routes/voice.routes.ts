import { Router } from 'express';

import type { VoiceBridgeControllers } from '@/controllers/voice-bridge.controller';
import type { VoiceTalkControllers } from '@/controllers/voice-talk.controller';
import type { VoiceControllers } from '@/controllers/voice.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import {
  bridgeAudioParamsSchema,
  bridgeLibraryQuerySchema,
  realtimeParamsSchema,
  voiceConsentSchema,
  voiceConsentWithdrawSchema,
  workerBriefQuerySchema,
  workerHeardSchema,
  workerScreenSchema,
  workerSpokenSchema,
  workerVoiceMetricSchema,
  workerVoiceTurnSchema,
} from '@/schemas/voice.schema';
import type { RateLimiter } from '@/types/rate-limit';

import type { RequestHandler } from 'express';

export function createVoiceStudentRouter(
  input: Readonly<{
    authorize: RequestHandler;
    limit: RateLimiter;
    controller: VoiceControllers;
  }>,
): Router {
  const router = Router();
  router.post(
    '/student/session/:id/realtime',
    input.authorize,
    input.limit('session'),
    validate(realtimeParamsSchema, 'params'),
    asyncHandler(input.controller.realtime),
  );
  return router;
}

/**
 * X-05: the worker's actor class is declared, never inferred.
 *
 * These routes sit behind `workerOnly`, so by the time a limit runs the shared secret has
 * already been checked. Inferring "worker" from the presence of an `Authorization` header
 * would instead let anybody who sends one claim the worker's much larger budget.
 */
export function createVoiceWorkerRouter(
  input: Readonly<{
    authorize: RequestHandler;
    limit: RateLimiter;
    controller: VoiceControllers;
    /** P2H-09. Always mounted: a deployment with no clips answers with an empty library. */
    bridges: VoiceBridgeControllers;
    /** "Aria talks": the brief and the transcript endpoints a realtime-model worker uses. */
    talk: VoiceTalkControllers;
  }>,
): Router {
  const router = Router();
  mountTalkRoutes(router, input);
  // One bucket for the fleet: a circuit breaker on our own reconnect loops, never a defence
  // against a worker we issued the secret to.
  router.use('/internal/voice', input.limit('read', { actorClass: 'worker' }));
  router.get(
    '/internal/voice/bridges',
    input.authorize,
    validate(bridgeLibraryQuerySchema, 'query'),
    asyncHandler(input.bridges.library),
  );
  router.get(
    '/internal/voice/bridges/:assetId/audio',
    input.authorize,
    validate(bridgeAudioParamsSchema, 'params'),
    asyncHandler(input.bridges.audio),
  );
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

/** "Aria talks": the brief, the two halves of the transcript, and the screen. */
function mountTalkRoutes(
  router: Router,
  input: Readonly<{ authorize: RequestHandler; limit: RateLimiter; talk: VoiceTalkControllers }>,
): void {
  // Mounted before the shared `/internal/voice` limit above, so these carry their own: a
  // turn's worth of transcript is far more frequent than a bridge library lookup.
  router.use('/internal/voice/session', input.limit('turn', { actorClass: 'worker' }));
  router.get(
    '/internal/voice/session/:id/brief',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    validate(workerBriefQuerySchema, 'query'),
    asyncHandler(input.talk.brief),
  );
  router.post(
    '/internal/voice/session/:id/heard',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    validate(workerHeardSchema, 'body'),
    asyncHandler(input.talk.heard),
  );
  router.post(
    '/internal/voice/session/:id/spoken',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    validate(workerSpokenSchema, 'body'),
    asyncHandler(input.talk.spoken),
  );
  router.post(
    '/internal/voice/session/:id/screen',
    input.authorize,
    validate(realtimeParamsSchema, 'params'),
    validate(workerScreenSchema, 'body'),
    asyncHandler(input.talk.screen),
  );
}

export function createVoiceAdminRouter(
  input: Readonly<{
    authorize: RequestHandler;
    limit: RateLimiter;
    controller: VoiceControllers;
  }>,
): Router {
  const router = Router();
  router.use('/operator', input.limit('mutation'));
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
