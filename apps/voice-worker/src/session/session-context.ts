import { z } from 'zod';

import { bandSchema, sessionIdSchema, type Band, type SessionId } from '@aria/shared';

const roomNameSchema = z.string().regex(/^aria_([0-9a-f-]{36})$/iu);
const metadataSchema = z.object({
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
  const match = roomNameSchema.safeParse(roomName);
  if (!match.success) throw new Error('Voice room name is not an Aria session room');
  const sessionId = /^aria_(.+)$/u.exec(match.data)?.[1];
  if (sessionId === undefined) throw new Error('Voice room is missing a session id');
  const metadata = metadataSchema.parse(JSON.parse(participantMetadata));
  return {
    sessionId: sessionIdSchema.parse(sessionId),
    connectionEpoch: metadata.connectionEpoch,
    band: metadata.band,
  };
}
