import {
  AgentSessionEventTypes,
  defineAgent,
  inference,
  voice,
  type JobContext,
} from '@livekit/agents';
import { RoomEvent, type LocalParticipant } from '@livekit/rtc-node';

import type { TutorMove, VoiceMetric } from '@aria/shared';
import { endpointingFor } from '@aria/voice';

import { createTutorVoiceClient } from '@/api/tutor-client';
import { readVoiceWorkerConfig, type VoiceWorkerConfig } from '@/config';
import {
  createAcknowledgementGate,
  type AcknowledgementGate,
} from '@/session/acknowledgement-gate';
import { parseClientEvent } from '@/session/client-event';
import { toVoiceMetric } from '@/session/metrics';
import { createMoveStream, type MoveStream } from '@/session/move-stream';
import { parseVoiceRoomContext, type VoiceRoomContext } from '@/session/session-context';
import { prepareVoiceStartup } from '@/session/startup-handshake';

const encoder = new TextEncoder();

export default defineAgent({ entry: runVoiceAgent });

async function runVoiceAgent(job: JobContext): Promise<void> {
  const config = readVoiceWorkerConfig(process.env);
  await job.connect();
  const participant = await job.waitForParticipant();
  const roomContext = parseVoiceRoomContext(
    required(job.room.name, 'voice room name'),
    required(participant.metadata, 'participant metadata'),
  );
  const localParticipant = required(job.room.localParticipant, 'local participant');
  const client = createTutorVoiceClient({
    baseUrl: config.apiUrl,
    token: config.workerToken,
    fetcher: globalThis.fetch,
  });
  const session = createAgentSession(config, roomContext);
  const moves = createMoveRuntime(roomContext, localParticipant, client, session);
  let sessionStarted = false;
  const finish = (): void => {
    void job.room.disconnect();
  };
  const acknowledgementReady = bindVoiceEvents({
    job,
    participantIdentity: participant.identity,
    localParticipant,
    moves,
    session,
    isSessionStarted: () => sessionStarted,
    finish,
    recordMetric: (metric) =>
      client.metric(roomContext.sessionId, {
        connectionEpoch: roomContext.connectionEpoch,
        metric,
      }),
  });
  const startup = await prepareVoiceStartup({
    authorize: moves.authorize,
    announceReady: () =>
      localParticipant.publishData(encoder.encode('{"kind":"WORKER_READY"}'), {
        reliable: true,
        topic: 'aria.voice-state',
      }),
    acknowledgement: acknowledgementReady.wait(),
  });
  if (!startup.acknowledged || acknowledgementReady.isClosed()) return;
  await session.start({
    agent: createAriaAgent(moves, session, finish),
    room: job.room,
    record: false,
  });
  sessionStarted = true;
  if (acknowledgementReady.isClosed()) {
    finish();
    return;
  }
  for await (const text of moves.resume()) session.say(text, { allowInterruptions: true });
  finishSilentTerminal(moves, finish);
}

function createMoveRuntime(
  room: VoiceRoomContext,
  participant: LocalParticipant,
  client: ReturnType<typeof createTutorVoiceClient>,
  session: ReturnType<typeof createAgentSession>,
): MoveStream {
  return createMoveStream({
    room,
    client,
    publisher: {
      publish: async (move) => {
        updateEndpointing(session, room, move);
        await participant.publishData(
          encoder.encode(JSON.stringify({ ...move, connectionEpoch: room.connectionEpoch })),
          {
            reliable: true,
            topic: 'aria.moves',
          },
        );
      },
    },
    nextId: () => crypto.randomUUID(),
    now: () => new Date(),
  });
}

function updateEndpointing(
  session: ReturnType<typeof createAgentSession>,
  room: VoiceRoomContext,
  move: TutorMove,
): void {
  const oralReading = move.kind === 'LISTEN' && move.purpose === 'read_aloud';
  const configured = endpointingFor({ band: room.band, expects: move.expects, oralReading });
  const endpointing = configured ?? { minDelaySeconds: 4, maxDelaySeconds: 4 };
  session.updateOptions({
    turnHandling: {
      endpointing: {
        mode: oralReading ? 'fixed' : 'dynamic',
        minDelay: endpointing.minDelaySeconds * 1_000,
        maxDelay: endpointing.maxDelaySeconds * 1_000,
      },
    },
  });
}

function createAgentSession(config: VoiceWorkerConfig, room: VoiceRoomContext) {
  const endpointing = endpointingFor({ band: room.band, expects: 'speech', oralReading: false });
  return new voice.AgentSession({
    stt: new inference.STT({ model: config.sttModel, language: 'en' }),
    tts: new inference.TTS({ model: config.ttsModel, voice: config.ttsVoice, language: 'en' }),
    turnHandling: {
      turnDetection: new inference.TurnDetector(),
      endpointing:
        endpointing === null
          ? {}
          : {
              mode: 'dynamic',
              minDelay: endpointing.minDelaySeconds * 1_000,
              maxDelay: endpointing.maxDelaySeconds * 1_000,
            },
      interruption: {
        enabled: true,
        mode: 'adaptive',
        minDuration: 300,
        minWords: 1,
        falseInterruptionTimeout: 1_500,
        resumeFalseInterruption: true,
      },
      preemptiveGeneration: { enabled: false, preemptiveTts: false },
    },
    expressive: false,
  });
}

type VoiceEventBindings = Readonly<{
  job: JobContext;
  participantIdentity: string;
  localParticipant: LocalParticipant;
  moves: MoveStream;
  session: ReturnType<typeof createAgentSession>;
  isSessionStarted(): boolean;
  finish(): void;
  recordMetric(metric: VoiceMetric): Promise<void>;
}>;

function bindVoiceEvents(input: VoiceEventBindings): AcknowledgementGate {
  const gate = createAcknowledgementGate();
  bindCloseEvents(input, gate);
  input.session.on(AgentSessionEventTypes.UserTranscriptionTimeout, () => {
    void input.localParticipant.publishData(encoder.encode('{"kind":"TRANSCRIPT_UNCLEAR"}'), {
      reliable: true,
      topic: 'aria.voice-state',
    });
  });
  input.session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
    if (event.oldState === 'speaking' && event.newState !== 'speaking') {
      reportSpeechFinished(input);
    }
  });
  input.session.on(AgentSessionEventTypes.MetricsCollected, (event) => {
    const metric = toVoiceMetric(event.metrics);
    if (metric === null) return;
    void input.recordMetric(metric).catch(() => {
      void input.localParticipant.publishData(encoder.encode('{"kind":"METRICS_UNAVAILABLE"}'), {
        reliable: true,
        topic: 'aria.voice-state',
      });
    });
  });
  input.job.room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    if (topic !== 'aria.client-event') return;
    const event = parseClientEvent(payload);
    if (event === null) return;
    if (event.kind === 'ACK') {
      input.moves.acceptAcknowledgement(event.acknowledgedSeq);
      gate.acknowledge();
      return;
    }
    if (!input.isSessionStarted()) return;
    if (event.kind === 'SYNC') {
      void speakPending(input.session, input.moves, input.finish);
      return;
    }
    if (event.kind === 'SPEECH_STARTED') {
      void discard(input.moves.speechStarted());
      return;
    }
    if (event.generationId !== input.moves.activeGenerationId()) return;
    void input.session.interrupt({ force: true });
  });
  return gate;
}

function bindCloseEvents(input: VoiceEventBindings, gate: AcknowledgementGate): void {
  input.session.on(AgentSessionEventTypes.Close, () => {
    gate.close();
    input.finish();
  });
  input.job.room.on(RoomEvent.Disconnected, gate.close);
  input.job.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    if (participant.identity !== input.participantIdentity) return;
    gate.close();
    input.finish();
  });
}

function reportSpeechFinished(
  input: Readonly<{
    localParticipant: LocalParticipant;
    moves: MoveStream;
    finish(): void;
  }>,
): void {
  input.moves.clearGeneration();
  const acknowledgedSeq = input.moves.takePendingPlaybackSeq();
  const reported =
    acknowledgedSeq === 0
      ? Promise.resolve()
      : input.localParticipant.publishData(
          encoder.encode(JSON.stringify({ kind: 'SPEECH_FINISHED', acknowledgedSeq })),
          { reliable: true, topic: 'aria.voice-state' },
        );
  if (input.moves.terminalSpeechPending()) void reported.finally(input.finish);
}

async function discard(values: AsyncIterable<unknown>): Promise<void> {
  for await (const _value of values) {
    // The observation is persisted by the API; it never creates child-facing output.
  }
}

async function speakPending(
  session: ReturnType<typeof createAgentSession>,
  moves: MoveStream,
  finish: () => void,
): Promise<void> {
  for await (const text of moves.resume()) session.say(text, { allowInterruptions: true });
  finishSilentTerminal(moves, finish);
}

/**
 * With `llm: null` the SDK resolves the activity's llm to `undefined` and returns from
 * `userTurnCompleted` before `llmNode` is ever reached, so transcripts were silently dropped.
 * `onUserTurnCompleted` runs before that guard; the tutor harness answers from there.
 */
function createAriaAgent(
  moves: MoveStream,
  session: ReturnType<typeof createAgentSession>,
  finish: () => void,
): voice.Agent {
  return voice.Agent.create({
    instructions: 'All child-facing content is supplied by the Aria tutor harness.',
    llm: null,
    onUserTurnCompleted: async (_context, _chatContext, message) => {
      const text = message.textContent ?? '';
      if (text.trim() === '') return;
      for await (const reply of moves.handleTranscript(text, message.transcriptConfidence)) {
        session.say(reply, { allowInterruptions: true });
      }
      finishSilentTerminal(moves, finish);
    },
  });
}

function finishSilentTerminal(moves: MoveStream, finish: () => void): void {
  if (moves.terminalDelivered() && !moves.terminalSpeechPending()) finish();
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`LiveKit did not provide ${label}`);
  return value;
}
