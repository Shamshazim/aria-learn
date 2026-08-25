import { z } from 'zod';

import {
  bandSchema,
  sessionIdSchema,
  voiceRoomName,
  type Band,
  type SessionId,
} from '@aria/shared';
import type { PronunciationHints } from '@aria/voice';


/**
 * P2H-08: how to say this child's name, from their profile.
 *
 * It travels in the participant token rather than being fetched, because the worker has no
 * database and the name it applies to is already in every sentence it speaks. Bounded, so a
 * profile cannot make a token unbounded.
 */
const pronunciationSchema = z
  .record(z.string().min(1).max(64), z.string().min(1).max(64))
  .refine((hints) => Object.keys(hints).length <= 16, 'at most 16 pronunciation hints');

const metadataSchema = z.object({
  sessionId: sessionIdSchema,
  connectionEpoch: z.number().int().nonnegative(),
  band: bandSchema,
  pronunciation: z
    .union([pronunciationSchema, z.string()])
    .optional()
    .transform((value) => (typeof value === 'string' ? parseHints(value) : (value ?? {}))),
});

export type VoiceRoomContext = Readonly<{
  sessionId: SessionId;
  connectionEpoch: number;
  band: Band;
  pronunciation: PronunciationHints;
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
    pronunciation: metadata.pronunciation,
  };
}

/** LiveKit token metadata is flat, so the hints arrive as a JSON string and are parsed here. */
function parseHints(value: string): PronunciationHints {
  // A hint that will not parse costs a name its spelling; it must not cost the child a session.
  try {
    const parsed = pronunciationSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
