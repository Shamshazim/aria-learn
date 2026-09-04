import { createHash } from 'node:crypto';

import type { Band } from '@aria/shared';

import { createVoiceBridgeControllers } from '@/controllers/voice-bridge.controller';
import { createVoiceTalkControllers } from '@/controllers/voice-talk.controller';
import { createVoiceControllers } from '@/controllers/voice.controller';
import { ServiceUnavailableError } from '@/errors';
import { operatorOnly } from '@/middleware/operator-only';
import { workerOnly } from '@/middleware/worker-only';
import { createBridgeObserver } from '@/observability/bridge-metrics';
import type { ParentConsentDeps } from '@/phase1/identity.runtime';
import type { createPhase1Runtime } from '@/phase1/runtime';
import type { Phase1RuntimeDeps } from '@/phase1/runtime.types';
import { createRetainedAudioRepository } from '@/repositories/retained-audio.repository';
import { createSpeechAssetRepository } from '@/repositories/speech-asset.repository';
import { createVoiceConsentRepository } from '@/repositories/voice-consent.repository';
import { createVoiceLifecycleRepository } from '@/repositories/voice-lifecycle.repository';
import { createVoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { RouterDeps } from '@/routes';
import {
  createAudioDeletionService,
  type AudioDeletionPort,
} from '@/services/voice/audio-deletion.service';
import {
  createBridgeLibraryService,
  type SpeechAudioPort,
} from '@/services/voice/bridge-library.service';
import { createVoiceConsentService } from '@/services/voice/consent.service';
import { withDemoVoiceConsent } from '@/services/voice/demo-consent';
import { createLivekitRoomCloser } from '@/services/voice/livekit-room.provider';
import { createLivekitTokenProvider } from '@/services/voice/livekit-token.provider';
import { createVoiceMetricsService } from '@/services/voice/metrics.service';
import { createStudentPronunciationSource } from '@/services/voice/pronunciation.source';
import { createRealtimeService } from '@/services/voice/realtime.service';
import { createTalkBriefService } from '@/services/voice/talk-brief.service';
import { createTalkEventsService } from '@/services/voice/talk-events.service';
import { createTalkScreenService } from '@/services/voice/talk-screen.service';
import { createWorkerTurnService } from '@/services/voice/worker-turn.service';

type Phase1Runtime = Awaited<ReturnType<typeof createPhase1Runtime>>;

/**
 * The voice runtime, plus the one part of it a parent route needs (P2H-12).
 *
 * Consent used to be granted through the operator router with a shared token. It still can
 * be, for support; what this exposes is the same service reached by a signed-in parent, which
 * is what P2-03 asked for and what the operator route was standing in for.
 */
export type Phase2Runtime = Readonly<{
  routes: NonNullable<RouterDeps['voice']>;
  consent: ParentConsentDeps;
}>;

export function createPhase2Runtime(
  deps: Phase1RuntimeDeps,
  phase1: Phase1Runtime,
  deletion: AudioDeletionPort = unavailableDeletionPort(),
  speechAudio: SpeechAudioPort = unavailableSpeechAudio(),
): Phase2Runtime {
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
  const controller = buildVoiceController({ deps, phase1, voiceSessions, realtime, consent });
  const bridges = createVoiceBridgeControllers({
    bridges: createBridgeLibraryService({
      assets: createSpeechAssetRepository(deps.pool),
      audio: speechAudio,
    }),
  });
  const talk = buildTalkControllers(deps, phase1, voiceSessions);
  const processors = processorMap(voiceConfig);
  return {
    routes: {
      // P2H-12: the same gate the student routes run, so a realtime token cannot be
      // negotiated by anything that could not have asked for the turn it belongs to.
      student: { authorize: phase1.identity.childAuth, controller },
      worker: { authorize: workerOnly(voiceConfig.workerToken), controller, bridges, talk },
      admin: { authorize: operatorOnly(operatorToken), controller },
    },
    consent: {
      grant: (input) => consent.grant(input),
      processorMapVersion: processorMapVersion(processors),
    },
  };
}

/**
 * A short digest of the processor map, stored on the consent record.
 *
 * Not a hand-maintained version number: the map is reworded whenever a region, a model or a
 * voice changes, and a number somebody has to remember to bump is a number that will say a
 * family agreed to wording they never saw.
 */
function processorMapVersion(processors: Readonly<Record<string, string>>): string {
  const canonical = Object.entries(processors)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16);
}

function buildVoiceController(
  input: Readonly<{
    deps: Phase1RuntimeDeps;
    phase1: Phase1Runtime;
    voiceSessions: ReturnType<typeof createVoiceSessionRepository>;
    realtime: ReturnType<typeof buildRealtime>;
    consent: ReturnType<typeof buildConsent>;
  }>,
): ReturnType<typeof createVoiceControllers> {
  const { deps, phase1, voiceSessions } = input;
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
    observeBridge: createBridgeObserver({ metrics: deps.metrics }),
    clock: deps.clock,
  });
  return createVoiceControllers({
    negotiate: input.realtime.negotiate,
    workerTurn: worker.handle,
    recordMetric: metrics.record,
    grant: input.consent.grant,
    withdraw: (consented) => input.consent.withdraw(consented.parentId, consented.studentId),
    logger: deps.logger,
    // P2H-07: without a bus the worker still gets one JSON body, exactly as before.
    ...(deps.segments === undefined ? {} : { segments: deps.segments }),
  });
}

/** "Aria talks": the brief the model teaches from, and the transcript it reports back. */
function buildTalkControllers(
  deps: Phase1RuntimeDeps,
  phase1: Phase1Runtime,
  voiceSessions: ReturnType<typeof createVoiceSessionRepository>,
): ReturnType<typeof createVoiceTalkControllers> {
  const shared = {
    sessions: phase1.repositories.sessions,
    voiceSessions,
    events: phase1.repositories.events,
    clock: deps.clock,
  };
  return createVoiceTalkControllers({
    brief: createTalkBriefService({
      ...shared,
      students: phase1.repositories.students,
      inventory: phase1.talk.inventory,
      retrieve: phase1.talk.retrieve,
      sessionLimitMinutes: (band) => deps.config.sessionLimitMinutes[band],
    }).brief,
    events: createTalkEventsService({ ...shared, safety: phase1.talk.safety }),
    screen: createTalkScreenService({
      ...shared,
      outbox: phase1.repositories.outbox,
      ids: deps.ids,
    }).show,
  });
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
  const processors = processorMap(input.voiceConfig);
  return createRealtimeService({
    sessions: input.phase1.repositories.sessions,
    // The demo student has no parent to ask; development mints the consent it would give.
    consent: withDemoVoiceConsent(input.consentRepo, {
      studentId: input.deps.config.demoStudentId,
      processors: Object.keys(processors),
    }),
    voiceSessions: input.voiceSessions,
    events: input.phase1.repositories.events,
    outbox: input.phase1.repositories.outbox,
    rooms: input.rooms,
    lifecycle: input.lifecycle,
    tokens: createLivekitTokenProvider(input.voiceConfig),
    // P2H-12: the parent's spelling, from the profile P2H-08 was waiting for.
    pronunciation: createStudentPronunciationSource(input.phase1.repositories.students),
    clock: input.deps.clock,
    livekitUrl: input.voiceConfig.livekitUrl,
    region: input.voiceConfig.region,
    processors,
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
    tts: `LiveKit Inference ${config.ttsModel} voices ${describeVoices(config.ttsVoices)}; receives gated text only`,
  };
}

/** Named per band, so the consent record says which voice a family actually heard (P2H-08). */
function describeVoices(voices: Readonly<Record<Band, string | undefined>>): string {
  return Object.entries(voices)
    .map(([band, voice]) => `${band}=${voice ?? 'unset'}`)
    .join(' ');
}

/** No object store is configured, so every band's library is empty and no bridge ever plays. */
function unavailableSpeechAudio(): SpeechAudioPort {
  return {
    read: () => Promise.reject(new ServiceUnavailableError('speech audio store is not configured')),
  };
}

function unavailableDeletionPort(): AudioDeletionPort {
  const unavailable = (): Promise<never> =>
    Promise.reject(
      new ServiceUnavailableError('retained audio deletion provider is not configured'),
    );
  return { deleteObject: unavailable, deleteProcessorCopy: unavailable };
}
