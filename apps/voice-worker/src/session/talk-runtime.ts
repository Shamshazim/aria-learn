import { appendFile } from 'node:fs/promises';

import type { TutorMove } from '@aria/shared';

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
  metrics: S2SMetrics;
  currentAskId(): string | null;
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
  const metrics = createS2SMetrics({
    provider: `${s2s.provider}/${s2s.model}`,
    now: () => Date.now(),
    nextId: () => crypto.randomUUID(),
    sink: s2s.runLogPath === null ? null : (line) => appendFile(s2s.runLogPath ?? '', line),
  });
  let askId: string | null = null;
  let collected: TutorMove[] = [];
  const handlers = { silence: (_payload: SilencePayload): void => undefined };
  const silence = createSilenceTimer({
    band: room.band,
    onSilence: (payload) => {
      handlers.silence(payload);
    },
  });
  const moves = createMoveStream({
    room,
    client: createTutorVoiceClient(auth),
    // The renderer's prosody markers are for a TTS engine; a realtime model reads plain text.
    renderer: createSpeechRenderer({ ttsModel: 'plain', hints: room.pronunciation }),
    publisher: {
      publish: async (move: TutorMove) => {
        if (move.kind === 'ASK') askId = move.id;
        collected.push(move);
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
    talk: createTalkClient(auth),
    moves,
    silence,
    handlers,
    metrics,
    currentAskId: () => askId,
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
