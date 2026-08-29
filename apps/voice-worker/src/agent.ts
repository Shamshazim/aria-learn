import { defineAgent, voice, type JobContext } from '@livekit/agents';

import { createTutorVoiceClient } from '@/api/tutor-client';
import { readVoiceWorkerConfig, type VoiceWorkerConfig } from '@/config';
import {
  createAgentSession,
  updateEndpointing,
  type AriaAgentSession,
} from '@/session/agent-session';
import { createSessionBridge } from '@/session/bridge-runtime';
import type { BridgeTurn } from '@/session/bridge-turn';
import { createMoveStream, type MoveStream } from '@/session/move-stream';
import { parseVoiceRoomContext, type VoiceRoomContext } from '@/session/session-context';
import { createSilenceTimer, type SilenceTimer } from '@/session/silence-timer';
import { finishSilentTerminal, speakSilence, speakStream } from '@/session/speak';
import { prepareVoiceStartup } from '@/session/startup-handshake';
import { runTalkVoiceAgent } from '@/session/talk-session';
import { bindVoiceEvents } from '@/session/voice-events';
import { createSpeechRenderer, type SpeechRenderer } from '@/voice/speech-renderer';

import type { LocalParticipant } from '@livekit/rtc-node';

const encoder = new TextEncoder();

export default defineAgent({ entry: runVoiceAgent });

async function runVoiceAgent(job: JobContext): Promise<void> {
  const config = readVoiceWorkerConfig(process.env);
  // P2H-15: the spike replaces the whole pipeline for this worker, or nothing about it.
  if (config.s2s !== null) return runTalkVoiceAgent(job, config, config.s2s);
  await job.connect();
  const participant = await job.waitForParticipant();
  const room = parseVoiceRoomContext(
    required(job.room.name, 'voice room name'),
    required(participant.metadata, 'participant metadata'),
  );
  const localParticipant = required(job.room.localParticipant, 'local participant');
  const { client, session, runtime } = await startSession(config, room, localParticipant);
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

/**
 * Everything a session needs before the first word: the control-plane client, the LiveKit
 * session with this band's voice, and the move stream that feeds it.
 */
async function startSession(
  config: VoiceWorkerConfig,
  room: VoiceRoomContext,
  localParticipant: LocalParticipant,
): Promise<
  Readonly<{
    client: ReturnType<typeof createTutorVoiceClient>;
    session: AriaAgentSession;
    runtime: VoiceRuntime;
  }>
> {
  const client = createTutorVoiceClient({
    baseUrl: config.apiUrl,
    token: config.workerToken,
    fetcher: globalThis.fetch,
  });
  const session = createAgentSession(config, room);
  // P2H-09: fetched once, before the first word, because a clip fetched when the gap opens is
  // the wait it was meant to cover.
  const bridge = await createSessionBridge({
    config,
    room,
    session,
    fetcher: globalThis.fetch,
    now: () => Date.now(),
    report: (metric) => {
      // A counter the control plane never receives is a counter, not a session: the turn goes
      // on either way, and the failure is already visible as a gap in the series.
      client
        .metric(room.sessionId, { connectionEpoch: room.connectionEpoch, metric })
        .catch(() => undefined);
    },
  });
  const runtime = createRuntime({
    room,
    localParticipant,
    client,
    session,
    bridge,
    // P2H-08: built once per session, from this child's profile and this vendor's abilities.
    renderer: createSpeechRenderer({ ttsModel: config.ttsModel, hints: room.pronunciation }),
  });
  return { client, session, runtime };
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
    renderer: SpeechRenderer;
    bridge: BridgeTurn | undefined;
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
    renderer: input.renderer,
    bridge: input.bridge,
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
  // P2H-09: a `SWITCH` or a `BREAK` makes the next gap a transition rather than a reply.
  input.bridge?.observeMove(move);
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
