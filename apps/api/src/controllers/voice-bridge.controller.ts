import { bridgeLibrarySchema, type BridgeLibrary } from '@aria/shared';

import { bridgeAudioParamsSchema, bridgeLibraryQuerySchema } from '@/schemas/voice.schema';
import type { BridgeLibraryService } from '@/services/voice/bridge-library.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

export type VoiceBridgeControllers = Readonly<{
  library: RequestHandler;
  audio: RequestHandler;
}>;

/**
 * The worker's half of the bridge library (P2H-09).
 *
 * Two routes rather than one: the list is small enough to parse on every session start, and the
 * audio is fetched once per clip and cached for the life of the room. Sending both together
 * would put a megabyte of PCM in front of the first word Aria says.
 */
export function createVoiceBridgeControllers(deps: {
  bridges: BridgeLibraryService;
}): VoiceBridgeControllers {
  return {
    library: async (request: Request, response: Response<ApiResponse<BridgeLibrary>>) => {
      const query = bridgeLibraryQuerySchema.parse(request.validated?.query);
      response
        .status(200)
        .json({ data: bridgeLibrarySchema.parse(await deps.bridges.list(query)) });
    },
    audio: async (request: Request, response: Response) => {
      const { assetId } = bridgeAudioParamsSchema.parse(request.validated?.params);
      const audio = await deps.bridges.audio(assetId);
      response
        .status(200)
        .type('application/octet-stream')
        // Hash-addressed: a clip's bytes never change, so a worker may keep them for good.
        .set('cache-control', 'public, max-age=31536000, immutable')
        .send(Buffer.from(audio));
    },
  };
}
