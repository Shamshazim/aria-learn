import { createVoiceControllers } from '@/controllers/voice.controller';
import { ServiceUnavailableError } from '@/errors';
import { operatorOnly } from '@/middleware/operator-only';
import { requireStudentAccess } from '@/middleware/student-access';
import { workerOnly } from '@/middleware/worker-only';
import type { createPhase1Runtime } from '@/phase1/runtime';
import type { Phase1RuntimeDeps } from '@/phase1/runtime.types';
import { createRetainedAudioRepository } from '@/repositories/retained-audio.repository';
import { createVoiceConsentRepository } from '@/repositories/voice-consent.repository';
import { createVoiceLifecycleRepository } from '@/repositories/voice-lifecycle.repository';
import { createVoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { RouterDeps } from '@/routes';
import {
  createAudioDeletionService,
  type AudioDeletionPort,
} from '@/services/voice/audio-deletion.service';
import { createVoiceConsentService } from '@/services/voice/consent.service';
import { createLivekitRoomCloser } from '@/services/voice/livekit-room.provider';
import { createLivekitTokenProvider } from '@/services/voice/livekit-token.provider';
import { createVoiceMetricsService } from '@/services/voice/metrics.service';
import { createRealtimeService } from '@/services/voice/realtime.service';
import { createWorkerTurnService } from '@/services/voice/worker-turn.service';

type Phase1Runtime = Awaited<ReturnType<typeof createPhase1Runtime>>;

export function createPhase2Runtime(
  deps: Phase1RuntimeDeps,
  phase1: Phase1Runtime,
  deletion: AudioDeletionPort = unavailableDeletionPort(),
): NonNullable<RouterDeps['voice']> {
  const { voiceConfig, operatorToken } = requireVoiceConfig(deps);
  const consentRepo = createVoiceConsentRepository(deps.pool);
  const voiceSessions = createVoiceSessionRepository(deps.pool);
  const lifecycle = createVoiceLifecycleRepository(deps.pool);
  const rooms = createLivekitRoomCloser({
    url: voiceConfig.livekitUrl,
    apiKey: voiceConfig.apiKey,
    apiSecret: voiceConfig.apiSecret,
  });
  const consent = buildConsent({
    deps,
    phase1,
    deletion,
    consentRepo,
    voiceSessions,
    voiceConfig,
    rooms,
    lifecycle,
  });
  const realtime = buildRealtime({
    deps,
    phase1,
    consentRepo,
    voiceSessions,
    voiceConfig,
    rooms,
    lifecycle,
  });
  const worker = createWorkerTurnService({
    sessions: phase1.repositories.sessions,
    voiceSessions,
    outbox: phase1.repositories.outbox,
    events: phase1.repositories.events,
    turn: phase1.turn,
    clock: deps.clock,
  });
  const metrics = createVoiceMetricsService({
    sessions: phase1.repositories.sessions,
    voiceSessions,
    events: phase1.repositories.events,
    clock: deps.clock,
  });
  const controller = createVoiceControllers({
    negotiate: realtime.negotiate,
    workerTurn: worker.handle,
    recordMetric: metrics.record,
    grant: consent.grant,
    withdraw: (input) => consent.withdraw(input.parentId, input.studentId),
  });
  return {
    student: { authorize: requireStudentAccess(deps.access), controller },
    worker: { authorize: workerOnly(voiceConfig.workerToken), controller },
    admin: { authorize: operatorOnly(operatorToken), controller },
  };
}

function requireVoiceConfig(deps: Phase1RuntimeDeps): {
  voiceConfig: NonNullable<Phase1RuntimeDeps['config']['voice']>;
  operatorToken: string;
} {
  const voiceConfig = deps.config.voice;
  const operatorToken = deps.config.statusOperatorToken;
  if (voiceConfig === undefined || operatorToken === undefined) {
    throw new ServiceUnavailableError('voice runtime is not configured');
  }
  return { voiceConfig, operatorToken };
}

function buildRealtime(input: {
  deps: Phase1RuntimeDeps;
  phase1: Phase1Runtime;
  consentRepo: ReturnType<typeof createVoiceConsentRepository>;
  voiceSessions: ReturnType<typeof createVoiceSessionRepository>;
  voiceConfig: NonNullable<Phase1RuntimeDeps['config']['voice']>;
  rooms: ReturnType<typeof createLivekitRoomCloser>;
  lifecycle: ReturnType<typeof createVoiceLifecycleRepository>;
}) {
  return createRealtimeService({
    sessions: input.phase1.repositories.sessions,
    consent: input.consentRepo,
    voiceSessions: input.voiceSessions,
    events: input.phase1.repositories.events,
    outbox: input.phase1.repositories.outbox,
    rooms: input.rooms,
    lifecycle: input.lifecycle,
    tokens: createLivekitTokenProvider(input.voiceConfig),
    clock: input.deps.clock,
    livekitUrl: input.voiceConfig.livekitUrl,
    region: input.voiceConfig.region,
    processors: processorMap(input.voiceConfig),
  });
}

function buildConsent(input: {
  deps: Phase1RuntimeDeps;
  phase1: Phase1Runtime;
  deletion: AudioDeletionPort;
  consentRepo: ReturnType<typeof createVoiceConsentRepository>;
  voiceSessions: ReturnType<typeof createVoiceSessionRepository>;
  voiceConfig: NonNullable<Phase1RuntimeDeps['config']['voice']>;
  rooms: ReturnType<typeof createLivekitRoomCloser>;
  lifecycle: ReturnType<typeof createVoiceLifecycleRepository>;
}) {
  return createVoiceConsentService({
    students: input.phase1.repositories.students,
    consent: input.consentRepo,
    sessions: input.voiceSessions,
    deletion: createAudioDeletionService({
      audio: createRetainedAudioRepository(input.deps.pool),
      deletion: input.deletion,
    }),
    rooms: input.rooms,
    lifecycle: input.lifecycle,
    ids: input.deps.ids,
    clock: input.deps.clock,
  });
}

function processorMap(
  config: NonNullable<Phase1RuntimeDeps['config']['voice']>,
): Readonly<Record<string, string>> {
  return {
    media: `LiveKit media transport in ${config.region}; session recording disabled`,
    stt: `LiveKit Inference ${config.sttModel}; child-audio zero-retention terms required`,
    tts: `LiveKit Inference ${config.ttsModel} voice ${config.ttsVoice}; receives gated text only`,
  };
}

function unavailableDeletionPort(): AudioDeletionPort {
  const unavailable = (): Promise<never> =>
    Promise.reject(
      new ServiceUnavailableError('retained audio deletion provider is not configured'),
    );
  return { deleteObject: unavailable, deleteProcessorCopy: unavailable };
}
