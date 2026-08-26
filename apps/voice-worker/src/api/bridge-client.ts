import { AudioFrame } from '@livekit/rtc-node';
import { z } from 'zod';

import { bridgeLibrarySchema, type Band } from '@aria/shared';
import { BRIDGE_BUCKETS, type BridgeBucket, type BridgeClip } from '@aria/voice';

export type LoadedBridge = Readonly<{ clip: BridgeClip; audio: readonly AudioFrame[] }>;

export type BridgeClient = Readonly<{
  /** Every clip this session may play, with its audio already in memory. */
  load(input: Readonly<{ band: Band; voice: string }>): Promise<readonly LoadedBridge[]>;
}>;

/**
 * One tenth of a second of audio per frame: small enough that a barge-in stops the clip
 * promptly, large enough that a 1.2 s bridge is a dozen frames rather than hundreds.
 */
const FRAME_MS = 100;

/**
 * Fetches the band's reviewed clips once, at session start (P2H-09).
 *
 * Once, and only this band's: a bridge that has to be fetched when the gap opens is not a
 * bridge, it is the wait it was meant to cover. A clip that will not load is dropped rather
 * than retried — a library with a hole in it still bridges, and the picker never offers what
 * is not there.
 */
export function createBridgeClient(
  input: Readonly<{
    baseUrl: string;
    token: string;
    fetcher: typeof fetch;
    /** A clip whose audio has gone missing; the session plays on without it. */
    onUnavailable(clipId: string): void;
  }>,
): BridgeClient {
  return {
    load: async ({ band, voice }) => {
      const library = await fetchLibrary(input, band, voice);
      if (library === null) return [];
      const loaded = await Promise.all(
        library.clips.map((clip) =>
          loadOne(input, { sampleRate: library.sampleRate, band, voice, clip }),
        ),
      );
      return loaded.flatMap((item) => (item === null ? [] : [item]));
    },
  };
}

const envelopeSchema = z.object({ data: bridgeLibrarySchema });

async function fetchLibrary(
  input: Parameters<typeof createBridgeClient>[0],
  band: Band,
  voice: string,
): Promise<ReturnType<typeof bridgeLibrarySchema.parse> | null> {
  const query = new URLSearchParams({ band, voice }).toString();
  const response = await input.fetcher(`${input.baseUrl}/api/v1/internal/voice/bridges?${query}`, {
    headers: { authorization: `Bearer ${input.token}` },
  });
  // A deployment with no library is a deployment with no bridges, not a failed session.
  if (!response.ok) return null;
  const parsed = envelopeSchema.safeParse(await response.json());
  return parsed.success ? parsed.data.data : null;
}

async function loadOne(
  input: Parameters<typeof createBridgeClient>[0],
  target: Readonly<{
    sampleRate: number;
    band: Band;
    voice: string;
    clip: Readonly<{ id: string; bucket: string; text: string }>;
  }>,
): Promise<LoadedBridge | null> {
  const { sampleRate, band, voice, clip } = target;
  const bucket = asBucket(clip.bucket);
  if (bucket === null) return null;
  const response = await input.fetcher(
    `${input.baseUrl}/api/v1/internal/voice/bridges/${encodeURIComponent(clip.id)}/audio`,
    { headers: { authorization: `Bearer ${input.token}` } },
  );
  if (!response.ok) {
    input.onUnavailable(clip.id);
    return null;
  }
  const samples = new Int16Array(await response.arrayBuffer());
  return {
    clip: {
      id: clip.id,
      bucket,
      band,
      voice,
      text: clip.text,
      durationMs: Math.round((samples.length / sampleRate) * 1_000),
    },
    audio: toFrames(samples, sampleRate),
  };
}

function asBucket(value: string): BridgeBucket | null {
  return BRIDGE_BUCKETS.find((bucket) => bucket === value) ?? null;
}

function toFrames(samples: Int16Array, sampleRate: number): readonly AudioFrame[] {
  const perFrame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1_000));
  const frames: AudioFrame[] = [];
  for (let offset = 0; offset < samples.length; offset += perFrame) {
    const chunk = samples.slice(offset, offset + perFrame);
    frames.push(new AudioFrame(chunk, sampleRate, 1, chunk.length));
  }
  return frames;
}
