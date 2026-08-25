import { defineAgent, voice, type JobContext } from '@livekit/agents';

import { createTutorVoiceClient } from '@/api/tutor-client';
import { readVoiceWorkerConfig } from '@/config';
import {
  createAgentSession,
  updateEndpointing,
  type AriaAgentSession,
} from '@/session/agent-session';
import { createMoveStream, type MoveStream } from '@/session/move-stream';
import { parseVoiceRoomContext, type VoiceRoomContext } from '@/session/session-context';
import { createSilenceTimer, type SilenceTimer } from '@/session/silence-timer';
import { finishSilentTerminal, speakSilence, speakStream } from '@/session/speak';
import { prepareVoiceStartup } from '@/session/startup-handshake';
import { bindVoiceEvents } from '@/session/voice-events';

import type { LocalParticipant } from '@livekit/rtc-node';

const encoder = new TextEncoder();

export default defineAgent({ entry: runVoiceAgent });

async function runVoiceAgent(job: JobContext): Promise<void> {
  const config = readVoiceWorkerConfig(process.env);
  await job.connect();
  const participant = await job.waitForParticipant();
  const room = parseVoiceRoomContext(
    required(job.room.name, 'voice room name'),
    required(participant.metadata, 'participant metadata'),
  );
  const localParticipant = required(job.room.localParticipant, 'local participant');
  const client = createTutorVoiceClient({
    baseUrl: config.apiUrl,
    token: config.workerToken,
    fetcher: globalThis.fetch,
  });
  const session = createAgentSession(config, room);
  const runtime = createRuntime({ room, localParticipant, client, session });
  let sessionStarted = false;
  const finish = (): void => {
    runtime.silence.stop();
    void job.room.disconnect();
  };
  const acknowledgementReady = bindVoiceEvents({
    job,
    silence: runtime.silence,
    participantIdentity: participant.identity,
    localParticipant,
    moves: runtime.moves,
    session,
    isSessionStarted: () => sessionStarted,
    finish,
    recordMetric: (metric) =>
      client.metric(room.sessionId, { connectionEpoch: room.connectionEpoch, metric }),
  });
  const startup = await prepareVoiceStartup({
    authorize: runtime.moves.authorize,
    announceReady: () =>
      localParticipant.publishData(encoder.encode('{"kind":"WORKER_READY"}'), {
        reliable: true,
        topic: 'aria.voice-state',
      }),
    acknowledgement: acknowledgementReady.wait(),
  });
  if (!startup.acknowledged || acknowledgementReady.isClosed()) return;
  await session.start({
    agent: createAriaAgent(runtime, session, finish),
    room: job.room,
    record: false,
  });
  sessionStarted = true;
  if (acknowledgementReady.isClosed()) {
    finish();
    return;
  }
  await speakStream(session, runtime.moves.resume());
  finishSilentTerminal(runtime.moves, finish);
}

type VoiceRuntime = Readonly<{ moves: MoveStream; silence: SilenceTimer }>;

/**
 * The move stream and the silence timer are mutually dependent: every published move arms the
 * timer, and every expired timer sends a `SILENCE` event back through the stream. Building
 * them together is what keeps that knot out of `runVoiceAgent`.
 */
function createRuntime(
  input: Readonly<{
    room: VoiceRoomContext;
    localParticipant: LocalParticipant;
    client: ReturnType<typeof createTutorVoiceClient>;
    session: AriaAgentSession;
  }>,
): VoiceRuntime {
  const runtime: { moves: MoveStream | null } = { moves: null };
  const silence = createSilenceTimer({
    band: input.room.band,
    onSilence: (payload) => {
      const moves = runtime.moves;
      if (moves !== null) void speakSilence(input.session, moves, payload);
    },
  });
  runtime.moves = createMoveStream({
    room: input.room,
    client: input.client,
    publisher: { publish: (move) => publishMove(input, silence, move) },
    nextId: () => crypto.randomUUID(),
    now: () => new Date(),
  });
  return { moves: runtime.moves, silence };
}

async function publishMove(
  input: Parameters<typeof createRuntime>[0],
  silence: SilenceTimer,
  move: Parameters<Parameters<typeof createMoveStream>[0]['publisher']['publish']>[0],
): Promise<void> {
  updateEndpointing(input.session, input.room, move);
  silence.armFor(move);
  await input.localParticipant.publishData(
    encoder.encode(JSON.stringify({ ...move, connectionEpoch: input.room.connectionEpoch })),
    { reliable: true, topic: 'aria.moves' },
  );
}

/**
 * With `llm: null` the SDK resolves the activity's llm to `undefined` and returns from
 * `userTurnCompleted` before `llmNode` is ever reached, so transcripts were silently dropped.
 * `onUserTurnCompleted` runs before that guard; the tutor harness answers from there.
 */
function createAriaAgent(
  runtime: VoiceRuntime,
  session: AriaAgentSession,
  finish: () => void,
): voice.Agent {
  return voice.Agent.create({
    instructions: 'All child-facing content is supplied by the Aria tutor harness.',
    llm: null,
    onUserTurnCompleted: async (_context, _chatContext, message) => {
      const text = message.textContent ?? '';
      if (text.trim() === '') return;
      // The child spoke, so nothing is owed a nudge; the harness decides what happens next.
      runtime.silence.backchannel();
      await speakStream(
        session,
        runtime.moves.handleTranscript(text, message.transcriptConfidence),
      );
      finishSilentTerminal(runtime.moves, finish);
    },
  });
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`LiveKit did not provide ${label}`);
  return value;
}
