import type { Band, BridgeLibrary } from '@aria/shared';

import { NotFoundError } from '@/errors';
import type { SpeechAssetRepository } from '@/repositories/speech-asset.repository';

/**
 * Where a reviewed clip's audio actually lives.
 *
 * A port because nothing in this repository has an object store yet: a deployment without one
 * serves an empty library and the child hears no bridges, which is the documented edge case
 * rather than a broken session.
 */
export type SpeechAudioPort = Readonly<{
  read(storageKey: string): Promise<Uint8Array>;
}>;

/** Mono signed 16-bit PCM. Storing decoded audio is what lets the worker play it with no codec. */
export const BRIDGE_SAMPLE_RATE = 24_000;

export type BridgeLibraryService = Readonly<{
  list(input: Readonly<{ band: Band; voice: string }>): Promise<BridgeLibrary>;
  audio(assetId: string): Promise<Uint8Array>;
}>;

export function createBridgeLibraryService(deps: {
  assets: Pick<SpeechAssetRepository, 'listApprovedBridges' | 'findById'>;
  audio: SpeechAudioPort;
}): BridgeLibraryService {
  return {
    list: async ({ band, voice }) => {
      const rows = await deps.assets.listApprovedBridges({ band, voice });
      return {
        band,
        voice,
        sampleRate: BRIDGE_SAMPLE_RATE,
        clips: rows.map((row) => ({
          id: row.id,
          bucket: row.bucket,
          text: row.writtenText,
        })),
      };
    },
    audio: async (assetId) => {
      const asset = await deps.assets.findById(assetId);
      if (asset === null) throw new NotFoundError('speech asset not found');
      return deps.audio.read(asset.storageKey);
    },
  };
}
