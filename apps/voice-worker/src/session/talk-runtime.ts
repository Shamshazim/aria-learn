import { appendFile } from 'node:fs/promises';

import type { TutorMove, VoiceWorkerState } from '@aria/shared';

import { createTalkClient, type TalkClient } from '@/api/talk-client';
import { createTutorVoiceClient } from '@/api/tutor-client';
import type { VoiceWorkerConfig } from '@/config';
import { createMoveStream, type MoveStream } from '@/session/move-stream';
import type { S2SConfig } from '@/session/s2s-config';
import { createS2SMetrics, type S2SMetrics } from '@/session/s2s-metrics';
import type { VoiceRoomContext } from '@/session/session-context';
import { createSilenceTimer, type SilenceTimer } from '@/session/silence-timer';
import { createSpeechRenderer } from '@/voice/speech-renderer';

import type { LocalParticipant } from '@livekit/rtc-node';

const encoder = new TextEncoder();

export type SilencePayload = Readonly<{ waitedMs: number; afterMoveId: string }>;

/** Everything a talking session holds besides the model itself. */
export type TalkRuntime = Readonly<{
  talk: TalkClient;
  moves: MoveStream;
  silence: SilenceTimer;
  /** Bound after the session starts, because a rung is spoken through the session. */
  handlers: { silence(payload: SilencePayload): void };
  /** Tells the browser what the voice is doing: ready, a caption, what it heard. */
  publishState(state: VoiceWorkerState): Promise<void>;
  metrics: S2SMetrics;
  currentAskId(): string | null;
  /** The latest `ASK` itself, for saying what a tapped choice was called. */
  currentAsk(): TutorMove | null;
  /** Puts a move the API already recorded — a screen Aria asked for — in front of the child. */
  publish(move: TutorMove): Promise<void>;
  /** The moves published since `beginTurn`, for a tool to read the verdict from. */
  beginTurn(): void;
  endTurn(): readonly TutorMove[];
}>;

export function createTalkRuntime(
  config: VoiceWorkerConfig,
  s2s: S2SConfig,
  room: VoiceRoomContext,
  localParticipant: LocalParticipant,
): TalkRuntime {
  const auth = { baseUrl: config.apiUrl, token: config.workerToken, fetcher: globalThis.fetch };
  const metrics = metricsFor(s2s);
  let ask: TutorMove | null = null;
  let collected: TutorMove[] = [];
  const handlers = { silence: (_payload: SilencePayload): void => undefined };
  const silence = createSilenceTimer({
    band: room.band,
    onSilence: (payload) => {
      handlers.silence(payload);
    },
  });
  const publish = async (move: TutorMove): Promise<void> => {
    if (move.kind === 'ASK') ask = move;
    collected.push(move);
    silence.armFor(move);
    await localParticipant.publishData(
      encoder.encode(JSON.stringify({ ...move, connectionEpoch: room.connectionEpoch })),
      { reliable: true, topic: 'aria.moves' },
    );
    // The realtime model says a move in its own words the moment it is published, so there is
    // no playback to wait for before the API may consider it delivered.
    if (move.serverSeq !== undefined) moves.acceptAcknowledgement(move.serverSeq);
  };
  const moves = createMoveStream({
    room,
    client: createTutorVoiceClient(auth),
    // The renderer's prosody markers are for a TTS engine; a realtime model reads plain text.
    renderer: createSpeechRenderer({ ttsModel: 'plain', hints: room.pronunciation }),
    publisher: { publish },
    nextId: () => crypto.randomUUID(),
    now: () => new Date(),
  });
  return {
    talk: createTalkClient(auth),
    moves,
    silence,
    handlers,
    metrics,
    currentAskId: () => ask?.id ?? null,
    currentAsk: () => ask,
    publish,
    publishState: (state) => publishState(localParticipant, state),
    beginTurn: () => {
      collected = [];
    },
    endTurn: () => {
      const turn = collected;
      collected = [];
      return turn;
    },
  };
}

function metricsFor(s2s: S2SConfig): S2SMetrics {
  return createS2SMetrics({
    provider: `${s2s.provider}/${s2s.model}`,
    now: () => Date.now(),
    nextId: () => crypto.randomUUID(),
    sink: s2s.runLogPath === null ? null : (line) => appendFile(s2s.runLogPath ?? '', line),
  });
}

function publishState(participant: LocalParticipant, state: VoiceWorkerState): Promise<void> {
  return participant.publishData(encoder.encode(JSON.stringify(state)), {
    reliable: true,
    topic: 'aria.voice-state',
  });
}
