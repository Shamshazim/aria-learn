import { voice, type JobContext } from '@livekit/agents';

import type { VoiceBrief } from '@aria/shared';

import type { VoiceWorkerConfig } from '@/config';
import type { S2SConfig } from '@/session/s2s-config';
import { bindS2SEvents } from '@/session/s2s-events';
import { createRealtimeModel } from '@/session/s2s-model';
import { parseVoiceRoomContext } from '@/session/session-context';
import { prepareVoiceStartup } from '@/session/startup-handshake';
import { AriaTalkAgent } from '@/session/talk-agent';
import {
  buildTalkInstructions,
  leaveInstruction,
  openingInstruction,
  silenceInstruction,
  topicChangedLine,
} from '@/session/talk-instructions';
import { createTalkRuntime, type TalkRuntime } from '@/session/talk-runtime';
import {
  answerFromScreen,
  createScreenTools,
  skipFromScreen,
  type ScreenAnswer,
  type ScreenSkip,
} from '@/session/talk-screen';
import {
  bindEnding,
  bindTranscripts,
  reportSpoken,
  voiceHarnessTurn,
  type RoomRef,
} from '@/session/talk-session.bindings';
import { createTalkTools, type TalkToolHooks } from '@/session/talk-tools';

/**
 * A session where Aria talks, behind `VOICE_S2S_PROVIDER`.
 *
 * The vendor's realtime model hears the child and answers in its own voice, from a brief the
 * API wrote for this child and this topic. The API stays the curriculum, the grader, the
 * memory and the safety layer: answers go through `record_answer`, a child who is done with a
 * question goes through `move_on`, every word either side says is reported back, a disclosure
 * gets the fixed crisis line, and unsafe speech is cut. The screen is hers too: `show_on_screen`
 * puts a surface in front of the child, and what the child taps, types or skips there comes
 * back into the conversation (`talk-screen.ts`). The screen also hears what the voice is
 * doing, so its status line follows her speech instead of guessing from the last move.
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
  const screen: ScreenHandlers = {
    answer: () => undefined,
    skip: () => undefined,
    leave: () => undefined,
  };
  const gate = bindS2SEvents({
    job,
    session,
    participantIdentity: participant.identity,
    moves: runtime.moves,
    silence: runtime.silence,
    metrics: runtime.metrics,
    finish,
    onScreenAnswer: (event) => {
      screen.answer(event);
    },
    onScreenSkip: (event) => {
      screen.skip(event);
    },
    onLeave: () => {
      screen.leave();
    },
    onAgentState: (state) => {
      void runtime.publishState({ kind: 'AGENT_STATE', state }).catch(() => undefined);
    },
  });
  const startup = await prepareVoiceStartup({
    authorize: runtime.moves.authorize,
    announceReady: () => runtime.publishState({ kind: 'WORKER_READY', talks: true }),
    acknowledgement: gate.wait(),
  });
  if (!startup.acknowledged || gate.isClosed()) return;
  await startTalking({ job, session, runtime, room, finish, screen, isClosed: gate.isClosed });
}

/** What the screen can tell the session once it is running; bound in `startTalking`. */
type ScreenHandlers = {
  answer(event: ScreenAnswer): void;
  skip(event: ScreenSkip): void;
  leave(): void;
};

/** The brief, the agent, the opening — everything after the room has said it is listening. */
async function startTalking(
  input: Readonly<{
    job: JobContext;
    session: voice.AgentSession;
    runtime: TalkRuntime;
    room: RoomRef;
    finish(): void;
    screen: ScreenHandlers;
    isClosed(): boolean;
  }>,
): Promise<void> {
  const { session, runtime, room, finish } = input;
  const brief = await runtime.talk.brief(room.sessionId, room.connectionEpoch);
  const ending = bindEnding(session, runtime, finish);
  bindTranscripts(session, runtime, room);
  const { agent, hooks } = createAgent({ session, runtime, room, brief, ending });
  await session.start({ agent, room: input.job.room, record: false });
  if (input.isClosed()) {
    finish();
    return;
  }
  bindScreen(
    input.screen,
    { session, hooks, talk: runtime.talk, room, currentAsk: runtime.currentAsk },
    ending,
  );
  runtime.handlers.silence = (payload) => {
    void voiceHarnessTurn(
      session,
      runtime,
      runtime.moves.silence(payload),
      silenceInstruction,
    ).then(() => {
      if (runtime.moves.terminalDelivered()) ending.afterSpeech();
    });
  };
  await voiceHarnessTurn(session, runtime, runtime.moves.resume(), (lines) =>
    openingInstruction(brief, lines),
  );
}

/** Aria and her tools. The tools need the agent, to rewrite its prompt when the topic changes. */
function createAgent(
  input: Readonly<{
    session: voice.AgentSession;
    runtime: TalkRuntime;
    room: RoomRef;
    brief: VoiceBrief;
    ending: Readonly<{ afterSpeech(): void }>;
  }>,
): Readonly<{ agent: AriaTalkAgent; hooks: TalkToolHooks }> {
  const { session, runtime, room, brief, ending } = input;
  const agentRef: { current: AriaTalkAgent | null } = { current: null };
  const hooks: TalkToolHooks = {
    moves: runtime.moves,
    currentAskId: runtime.currentAskId,
    beginTurn: runtime.beginTurn,
    endTurn: runtime.endTurn,
    onSessionOver: ending.afterSpeech,
    onTopicChanged: () =>
      agentRef.current === null
        ? Promise.resolve(null)
        : refreshTopic(agentRef.current, runtime, room),
  };
  const agent = new AriaTalkAgent({
    instructions: buildTalkInstructions(brief),
    tools: {
      ...createTalkTools(hooks),
      ...createScreenTools({
        talk: runtime.talk,
        room,
        publish: runtime.publish,
        currentAsk: runtime.currentAsk,
      }),
    },
    onSentence: (text) => {
      reportSpoken(session, runtime, room, text);
    },
  });
  agentRef.current = agent;
  return { agent, hooks };
}

/**
 * The lesson moved to another topic: the prompt is rewritten around the new brief, so the
 * model teaches what the curriculum is now asking about rather than the topic it opened with.
 */
async function refreshTopic(
  agent: AriaTalkAgent,
  runtime: TalkRuntime,
  room: RoomRef,
): Promise<string | null> {
  try {
    const brief = await runtime.talk.brief(room.sessionId, room.connectionEpoch);
    await agent.updateInstructions(buildTalkInstructions(brief));
    return topicChangedLine(brief);
  } catch {
    return null;
  }
}

/** What the screen sends once the session runs: an answer, a skip, or the end of the session. */
function bindScreen(
  screen: ScreenHandlers,
  deps: Parameters<typeof answerFromScreen>[0],
  ending: Readonly<{ afterSpeech(): void }>,
): void {
  const { session, hooks } = deps;
  const bound = screen;
  const afterTurn = (): void => {
    if (hooks.moves.terminalDelivered()) ending.afterSpeech();
  };
  bound.answer = (event) => {
    void answerFromScreen(deps, event)
      .then(afterTurn)
      .catch(() => undefined);
  };
  bound.skip = (event) => {
    void skipFromScreen(deps, event)
      .then(afterTurn)
      .catch(() => undefined);
  };
  bound.leave = () => {
    // The voice already ended it (end_session) and is saying goodbye; nothing more to do.
    if (hooks.moves.terminalDelivered()) return;
    ending.afterSpeech();
    session.generateReply({ instructions: leaveInstruction(), allowInterruptions: false });
  };
}

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`LiveKit did not provide ${label}`);
  return value;
}
