import { log } from '@livekit/agents';

import type { BridgeMetric } from '@aria/shared';

import { createBridgeClient } from '@/api/bridge-client';
import { voiceProfileFor, type VoiceWorkerConfig } from '@/config';
import type { AriaAgentSession } from '@/session/agent-session';
import { createBridgePlayer } from '@/session/bridge-player';
import { createBridgeTurn, type BridgeTurn } from '@/session/bridge-turn';
import { createFirstAudioEstimate } from '@/session/first-audio-estimate';
import type { VoiceRoomContext } from '@/session/session-context';

/**
 * Builds this session's bridge path, or nothing at all (P2H-09).
 *
 * A deployment that has recorded no clips for this band and voice gets `undefined` and a
 * warning: bridges are the thing that makes a wait feel attended to, and their absence is a
 * quieter tutor, not a broken one. Nothing downstream branches on it beyond the optional call.
 */
export async function createSessionBridge(
  input: Readonly<{
    config: VoiceWorkerConfig;
    room: VoiceRoomContext;
    session: Pick<AriaAgentSession, 'say'>;
    fetcher: typeof fetch;
    now(): number;
    report(metric: BridgeMetric): void;
  }>,
): Promise<BridgeTurn | undefined> {
  const voice = voiceProfileFor(input.config, input.room.band).voiceId;
  const client = createBridgeClient({
    baseUrl: input.config.apiUrl,
    token: input.config.workerToken,
    fetcher: input.fetcher,
    onUnavailable: (clipId) => {
      log().warn({ clipId }, 'A reviewed bridge clip has no audio and will not be played');
    },
    onLibraryUnreadable: (reason) => {
      log().warn({ reason }, 'The bridge library could not be read; this session will play none');
    },
  });
  const clips = await client.load({ band: input.room.band, voice });
  if (clips.length === 0) {
    log().warn(
      { band: input.room.band, voice },
      'No reviewed bridge clips for this band and voice; this session will play none',
    );
    return undefined;
  }
  return createBridgeTurn({
    player: createBridgePlayer({
      session: input.session,
      band: input.room.band,
      clips,
      seed: seedFor(input.room.sessionId),
      report: input.report,
      onError: (error) => {
        log().warn({ err: error }, 'A bridge clip failed to play');
      },
    }),
    estimate: createFirstAudioEstimate(),
    now: input.now,
  });
}

/**
 * The picker is seeded rather than random, so two children in the same band on the same day do
 * not hear the same clips in the same order — and one child's session can be replayed exactly.
 */
function seedFor(sessionId: string): number {
  let seed = 0;
  for (const character of sessionId) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return seed;
}
