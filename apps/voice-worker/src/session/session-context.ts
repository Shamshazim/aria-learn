import { z } from 'zod';

import {
  bandSchema,
  sessionIdSchema,
  voiceRoomName,
  type Band,
  type SessionId,
} from '@aria/shared';

const metadataSchema = z.object({
  sessionId: sessionIdSchema,
  connectionEpoch: z.number().int().nonnegative(),
  band: bandSchema,
});

export type VoiceRoomContext = Readonly<{
  sessionId: SessionId;
  connectionEpoch: number;
  band: Band;
}>;

export function parseVoiceRoomContext(
  roomName: string,
  participantMetadata: string,
): VoiceRoomContext {
  const metadata = metadataSchema.parse(JSON.parse(participantMetadata));
  if (roomName !== voiceRoomName(metadata.sessionId, metadata.connectionEpoch)) {
    throw new Error('Voice room does not match participant metadata');
  }
  return {
    sessionId: metadata.sessionId,
    connectionEpoch: metadata.connectionEpoch,
    band: metadata.band,
  };
}
