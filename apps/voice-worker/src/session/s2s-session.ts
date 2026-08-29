import { appendFile } from 'node:fs/promises';

import { voice, type JobContext } from '@livekit/agents';

import type { TutorMove } from '@aria/shared';

import { createTutorVoiceClient } from '@/api/tutor-client';
import type { VoiceWorkerConfig } from '@/config';
import { createMoveStream, type MoveStream } from '@/session/move-stream';
import { AriaS2SAgent } from '@/session/s2s-agent';
import type { S2SConfig } from '@/session/s2s-config';
import { bindS2SEvents } from '@/session/s2s-events';
import { createS2SMetrics, type S2SMetrics } from '@/session/s2s-metrics';
import { createRealtimeModel } from '@/session/s2s-model';
import { createSafetyTap, type SafetyTap } from '@/session/s2s-safety-tap';
import { createS2STools, plan, type PlannedSpeech } from '@/session/s2s-tools';
import { parseVoiceRoomContext, type VoiceRoomContext } from '@/session/session-context';
import { createSilenceTimer, type SilenceTimer } from '@/session/silence-timer';
import { prepareVoiceStartup } from '@/session/startup-handshake';
import { createSpeechRenderer } from '@/voice/speech-renderer';

import type { LocalParticipant } from '@livekit/rtc-node';

const encoder = new TextEncoder();

/** P2H-11's recovery register: short, warm, and the only line the tap allows after a cut. */
export const RECOVERY_LINE = 'Let me say that again.';

/**
 * P2H-15: a session carried by a vendor's realtime model, behind `VOICE_S2S_PROVIDER`.
 *
 * Same room, same control plane, same move stream, same silence ladder. What changes is who
 * turns text into sound and sound into text: the vendor hears the child directly and voices
 * the sentences the harness returns through the three tools. Every sentence still reaches
 * `move_outbox` through the API, because the move stream publishes the moves it planned.
 */
export async function runS2SVoiceAgent(
  job: JobContext,
  config: VoiceWorkerConfig,
  s2s: S2SConfig,
): Promise<void> {
  await job.connect();
  const participant = await job.waitForParticipant();
  const room = parseVoiceRoomContext(
    required(job.room.name, 'voice room name'),
    required(participant.metadata, 'participant metadata'),
  );
  const localParticipant = required(job.room.localParticipant, 'local participant');
  const runtime = createS2SRuntime(config, s2s, room, localParticipant);
  const session = new voice.AgentSession({
    llm: await createRealtimeModel(s2s),
    turnHandling: {
      turnDetection: 'realtime_llm',
      interruption: { enabled: true, mode: 'adaptive', minDuration: 300, minWords: 1 },
    },
  });
  const finish = (): void => {
    runtime.silence.stop();
    void job.room.disconnect();
  };
  const gate = bindS2SEvents({
    job,
    session,
    participantIdentity: participant.identity,
    moves: runtime.moves,
    silence: runtime.silence,
    metrics: runtime.metrics,
    finish,
  });
  const startup = await prepareVoiceStartup({
    authorize: runtime.moves.authorize,
    announceReady: () =>
      localParticipant.publishData(encoder.encode('{"kind":"WORKER_READY"}'), {
        reliable: true,
        topic: 'aria.voice-state',
      }),
    acknowledgement: gate.wait(),
  });
  if (!startup.acknowledged || gate.isClosed()) return;
  const speaker = createSpeaker(session, runtime, finish);
  await session.start({
    agent: createAgent(runtime, speaker, finish),
    room: job.room,
    record: false,
  });
  if (gate.isClosed()) {
    finish();
    return;
  }
  runtime.handlers.silence = (payload) => {
    void speaker.voice(runtime.moves.silence(payload));
  };
  await speaker.voice(runtime.moves.resume());
}

function createAgent(runtime: S2SRuntime, speaker: Speaker, finish: () => void): AriaS2SAgent {
  return new AriaS2SAgent({
    tools: createS2STools({
      moves: runtime.moves,
      tap: runtime.tap,
      currentAskId: runtime.currentAskId,
      onTurnEnded: () => {
        void runtime.metrics
          .closeTurn({ oralReading: false, sttError: false, estimatedCostUsd: 0 })
          .then(() => {
            if (runtime.moves.terminalDelivered()) finish();
          });
      },
    }),
    tap: runtime.tap,
    onOffPlan: (escapedWords) => {
      runtime.metrics.offPlan(escapedWords);
      void speaker.recover();
    },
  });
}

type S2SRuntime = Readonly<{
  moves: MoveStream;
  silence: SilenceTimer;
  /** Bound after the session starts, because a rung is spoken through the session. */
  handlers: { silence(payload: SilencePayload): void };
  tap: SafetyTap;
  metrics: S2SMetrics;
  currentAskId(): string | null;
}>;

type SilencePayload = Readonly<{ waitedMs: number; afterMoveId: string }>;

function createS2SRuntime(
  config: VoiceWorkerConfig,
  s2s: S2SConfig,
  room: VoiceRoomContext,
  localParticipant: LocalParticipant,
): S2SRuntime {
  const client = createTutorVoiceClient({
    baseUrl: config.apiUrl,
    token: config.workerToken,
    fetcher: globalThis.fetch,
  });
  const tap = createSafetyTap();
  const metrics = createS2SMetrics({
    provider: `${s2s.provider}/${s2s.model}`,
    now: () => Date.now(),
    nextId: () => crypto.randomUUID(),
    sink:
      s2s.runLogPath === null
        ? null
        : (line) => appendFile(required(s2s.runLogPath, 'run log'), line),
  });
  let askId: string | null = null;
  const handlers = { silence: (_payload: SilencePayload): void => undefined };
  const silence = createSilenceTimer({
    band: room.band,
    onSilence: (payload) => {
      handlers.silence(payload);
    },
  });
  const moves = createMoveStream({
    room,
    client,
    // The renderer's prosody markers are for a TTS engine; a realtime model reads plain text.
    renderer: createSpeechRenderer({ ttsModel: 'plain', hints: room.pronunciation }),
    publisher: {
      publish: async (move: TutorMove) => {
        if (move.kind === 'ASK') askId = move.id;
        silence.armFor(move);
        await localParticipant.publishData(
          encoder.encode(JSON.stringify({ ...move, connectionEpoch: room.connectionEpoch })),
          { reliable: true, topic: 'aria.moves' },
        );
      },
    },
    nextId: () => crypto.randomUUID(),
    now: () => new Date(),
  });
  return {
    moves,
    silence,
    handlers,
    tap,
    metrics,
    currentAskId: () => askId,
  };
}

/**
 * Harness-initiated speech — the opening, a silence rung, a recovery — goes through the model
 * as an instruction to say exact sentences, because a realtime model has no `say()`. The tap
 * is told first, so the model's rendering of those sentences is on-plan by construction.
 */
type Speaker = Readonly<{
  voice(speech: AsyncIterable<string>): Promise<void>;
  recover(): Promise<void>;
}>;

function createSpeaker(
  session: voice.AgentSession,
  runtime: S2SRuntime,
  finish: () => void,
): Speaker {
  let lastPlan: PlannedSpeech = { say: [], instruction: '' };
  const speak = (planned: PlannedSpeech): void => {
    lastPlan = planned;
    if (planned.say.length === 0) {
      if (runtime.moves.terminalDelivered()) finish();
      return;
    }
    session.generateReply({
      instructions: `${planned.instruction}\n${JSON.stringify({ say: planned.say })}`,
      allowInterruptions: true,
    });
  };
  return {
    voice: async (speech) => {
      speak(await plan({ tap: runtime.tap }, speech));
    },
    recover: async () => {
      await session.interrupt({ force: true }).await;
      runtime.tap.allow([RECOVERY_LINE, ...lastPlan.say]);
      speak({ say: [RECOVERY_LINE, ...lastPlan.say], instruction: lastPlan.instruction });
    },
  };
}

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`LiveKit did not provide ${label}`);
  return value;
}
