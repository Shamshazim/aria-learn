import { z } from 'zod';

import {
  messageIdSchema,
  protocolVersionSchema,
  sequenceSchema,
  timestampSchema,
} from './schemas/common.schema';
import { tutorInputEventSchema } from './schemas/events.schema';
import { tutorMoveSchema } from './schemas/moves.schema';
import { turnResponseSchema } from './schemas/session.schema';

export function voiceRoomName(sessionId: string, connectionEpoch: number): string {
  return `aria_${sessionId}_${String(connectionEpoch)}`;
}

export const realtimeCredentialsSchema = z.object({
  url: z.url(),
  token: z.string().min(1).max(8_192),
  room: z.string().min(1).max(128),
  region: z.string().min(2).max(32),
  expiresAt: timestampSchema,
  processors: z.array(z.string().min(1).max(64)).min(1).max(8),
  connectionEpoch: sequenceSchema,
});

/** What the child actually heard before they talked over it (P2H-07 barge-in). */
export const spokenPrefixSchema = z.object({
  generationId: messageIdSchema,
  /** The index of the last segment that reached the speaker. */
  index: sequenceSchema,
});

export const voiceTurnRequestSchema = z.object({
  protocolVersion: protocolVersionSchema,
  event: tutorInputEventSchema,
  replayOnly: z.boolean().default(false),
  authorizeOnly: z.boolean().default(false),
  acknowledgedSeq: sequenceSchema,
  connectionEpoch: sequenceSchema,
  /** Set when this event interrupted a generation partway through (P2H-07). */
  spokenPrefix: spokenPrefixSchema.optional(),
});

export const voiceTurnResponseSchema = z.object({
  connectionEpoch: sequenceSchema,
  moves: z.array(tutorMoveSchema).max(128),
});

/**
 * P2H-07: one gated sentence, on its way to a child's ears before the rest exists.
 *
 * A move used to arrive whole, which meant the child heard nothing until the last token was
 * generated. A segment is the smallest thing that is safe to say: it has passed the quality
 * gate on its own, and it is numbered, so the worker speaks them in the order they were
 * written and drops the ones that arrive after a barge-in.
 */
export const moveSegmentSchema = z.object({
  kind: z.literal('MOVE_SEGMENT'),
  /** The generation this sentence belongs to. Cancelling a generation drops all of them. */
  generationId: messageIdSchema,
  /** The move this sentence ends up inside, so a late duplicate can be recognised. */
  moveId: messageIdSchema,
  index: sequenceSchema,
  /** What a caption shows. */
  text: z.string().min(1).max(2_000),
  /** What the voice says: the same sentence with numerals and symbols spoken out. */
  speech: z.string().min(1).max(2_000),
  /**
   * Known-final. Whole-item kinds set it on their single segment, and a sentence stream sets
   * it on the remainder it flushes. A stream that ends exactly on a sentence boundary sets it
   * on nothing, so the closing frame — never a segment — is what ends a turn.
   */
  isLast: z.boolean(),
});

/** The text channel, over SSE: sentences as they pass the gate, then the turn itself. */
export const turnFrameSchema = z.discriminatedUnion('kind', [
  moveSegmentSchema,
  z.object({ kind: z.literal('TURN_MOVES'), turn: turnResponseSchema }),
]);

/** The voice channel, over NDJSON: the same sentences, then the worker's move batch. */
export const voiceTurnFrameSchema = z.discriminatedUnion('kind', [
  moveSegmentSchema,
  z.object({ kind: z.literal('TURN_MOVES'), turn: voiceTurnResponseSchema }),
]);

export const voiceClientEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ACK'), acknowledgedSeq: sequenceSchema }),
  z.object({ kind: z.literal('SPEECH_STARTED') }),
  z.object({ kind: z.literal('SYNC') }),
  z.object({ kind: z.literal('STOP'), generationId: z.string().min(1).max(128) }),
]);

export const voiceWorkerStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('WORKER_READY') }),
  z.object({ kind: z.literal('TRANSCRIPT_UNCLEAR') }),
  z.object({ kind: z.literal('METRICS_UNAVAILABLE') }),
  z.object({ kind: z.literal('SPEECH_FINISHED'), acknowledgedSeq: sequenceSchema }),
]);

const boundedMetric = z.number().nonnegative().max(120_000);
export const voiceMetricSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('end_of_turn'),
    endOfUtteranceMs: boundedMetric,
    transcriptionMs: boundedMetric,
  }),
  z.object({
    kind: z.literal('tts'),
    ttfbMs: boundedMetric,
    durationMs: boundedMetric,
    cancelled: z.boolean(),
  }),
  z.object({ kind: z.literal('stt'), audioDurationMs: boundedMetric }),
  z.object({
    kind: z.literal('interruption'),
    detectionMs: boundedMetric,
    interruptions: sequenceSchema,
    backchannels: sequenceSchema,
  }),
  z.object({
    kind: z.literal('turn_detector'),
    totalMs: boundedMetric,
    inferenceMs: boundedMetric,
    detectionMs: boundedMetric,
  }),
]);

export const voiceMetricRequestSchema = z.object({
  connectionEpoch: sequenceSchema,
  metric: voiceMetricSchema,
});

export type RealtimeCredentialsDto = z.infer<typeof realtimeCredentialsSchema>;
export type VoiceTurnRequest = z.infer<typeof voiceTurnRequestSchema>;
export type VoiceTurnResponse = z.infer<typeof voiceTurnResponseSchema>;
export type SpokenPrefix = z.infer<typeof spokenPrefixSchema>;
export type MoveSegment = z.infer<typeof moveSegmentSchema>;
export type TurnFrame = z.infer<typeof turnFrameSchema>;
export type VoiceTurnFrame = z.infer<typeof voiceTurnFrameSchema>;
export type VoiceClientEvent = z.infer<typeof voiceClientEventSchema>;
export type VoiceWorkerState = z.infer<typeof voiceWorkerStateSchema>;
export type VoiceMetric = z.infer<typeof voiceMetricSchema>;
export type VoiceMetricRequest = z.infer<typeof voiceMetricRequestSchema>;
