import { AgentSessionEventTypes, voice, type JobContext } from '@livekit/agents';

import type { VoiceWorkerConfig } from '@/config';
import type { S2SConfig } from '@/session/s2s-config';
import { bindS2SEvents } from '@/session/s2s-events';
import { createRealtimeModel } from '@/session/s2s-model';
import { parseVoiceRoomContext } from '@/session/session-context';
import { prepareVoiceStartup } from '@/session/startup-handshake';
import { AriaTalkAgent } from '@/session/talk-agent';
import {
  buildTalkInstructions,
  crisisInstruction,
  openingInstruction,
  silenceInstruction,
  steerInstruction,
} from '@/session/talk-instructions';
import { createTalkRuntime, type TalkRuntime } from '@/session/talk-runtime';
import { createTalkTools } from '@/session/talk-tools';

const encoder = new TextEncoder();

/**
 * A session where Aria talks, behind `VOICE_S2S_PROVIDER`.
 *
 * The vendor's realtime model hears the child and answers in its own voice, from a brief the
 * API wrote for this child and this topic. The API stays the curriculum, the grader, the
 * memory and the safety layer: answers go through `record_answer`, every word either side
 * says is reported back, a disclosure gets the fixed crisis line, and unsafe speech is cut.
 * Same room, same control plane, same silence ladder as the pipeline.
 */
export async function runTalkVoiceAgent(
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
  const runtime = createTalkRuntime(config, s2s, room, localParticipant);
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
  await startTalking({ job, session, runtime, room, finish, isClosed: gate.isClosed });
}

/** The brief, the agent, the opening — everything after the room has said it is listening. */
async function startTalking(
  input: Readonly<{
    job: JobContext;
    session: voice.AgentSession;
    runtime: TalkRuntime;
    room: Readonly<{ sessionId: string; connectionEpoch: number }>;
    finish(): void;
    isClosed(): boolean;
  }>,
): Promise<void> {
  const { session, runtime, room, finish } = input;
  const brief = await runtime.talk.brief(room.sessionId, room.connectionEpoch);
  const ending = bindEnding(session, runtime, finish);
  bindTranscripts(session, runtime, room);
  await session.start({
    agent: new AriaTalkAgent({
      instructions: buildTalkInstructions(brief),
      tools: createTalkTools({
        moves: runtime.moves,
        currentAskId: runtime.currentAskId,
        beginTurn: runtime.beginTurn,
        endTurn: runtime.endTurn,
        onSessionOver: ending.afterSpeech,
      }),
      onSentence: (text) => {
        reportSpoken(session, runtime, room, text);
      },
    }),
    room: input.job.room,
    record: false,
  });
  if (input.isClosed()) {
    finish();
    return;
  }
  runtime.handlers.silence = (payload) => {
    void voiceHarnessTurn(session, runtime, runtime.moves.silence(payload), silenceInstruction).then(
      () => {
        if (runtime.moves.terminalDelivered()) ending.afterSpeech();
      },
    );
  };
  await voiceHarnessTurn(session, runtime, runtime.moves.resume(), (lines) =>
    openingInstruction(brief, lines),
  );
}

/** A harness-initiated turn — the opening, a silence rung — voiced in the model's own words. */
async function voiceHarnessTurn(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  speech: AsyncIterable<string>,
  instruction: (lines: readonly string[]) => string,
): Promise<void> {
  runtime.beginTurn();
  const lines: string[] = [];
  for await (const line of speech) lines.push(line);
  runtime.endTurn();
  session.generateReply({ instructions: instruction(lines), allowInterruptions: true });
}

/**
 * The child's words go to the API as they are transcribed: the transcript stays complete, and
 * a disclosure gets the fixed crisis line the pipeline would give, spoken over whatever the
 * model was about to say.
 */
function bindTranscripts(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  room: Readonly<{ sessionId: string; connectionEpoch: number }>,
): void {
  session.on(AgentSessionEventTypes.UserInputTranscribed, (event) => {
    const text = event.transcript.trim();
    if (!event.isFinal || text === '') return;
    void runtime.talk
      .heard(room.sessionId, { connectionEpoch: room.connectionEpoch, text })
      .then((result) => {
        if (result.crisis === null) return;
        void session.interrupt({ force: true }).await.then(() => {
          session.generateReply({
            instructions: crisisInstruction(result.crisis?.say ?? ''),
            allowInterruptions: false,
          });
        });
      })
      .catch(() => undefined);
  });
}

function reportSpoken(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  room: Readonly<{ sessionId: string; connectionEpoch: number }>,
  text: string,
): void {
  void runtime.talk
    .spoken(room.sessionId, { connectionEpoch: room.connectionEpoch, text })
    .then((result) => {
      if (result.verdict !== 'unsafe') return;
      runtime.metrics.offPlan(text.split(/\s+/u).length);
      void session.interrupt({ force: true }).await.then(() => {
        session.generateReply({ instructions: steerInstruction(), allowInterruptions: true });
      });
    })
    .catch(() => undefined);
}

/** The session ends after Aria has finished her last sentence, not while she is saying it. */
function bindEnding(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  finish: () => void,
): Readonly<{ afterSpeech(): void }> {
  let pending = false;
  let spoke = false;
  session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
    if (event.newState === 'speaking') spoke = true;
    if (event.oldState !== 'speaking') return;
    void runtime.metrics.closeTurn({ oralReading: false, sttError: false, estimatedCostUsd: 0 });
    if (pending && spoke) finish();
  });
  return {
    afterSpeech: () => {
      pending = true;
      spoke = false;
    },
  };
}

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`LiveKit did not provide ${label}`);
  return value;
}
