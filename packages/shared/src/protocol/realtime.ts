import { z } from 'zod';

import { protocolVersionSchema, sequenceSchema, timestampSchema } from './schemas/common.schema';
import { tutorInputEventSchema } from './schemas/events.schema';
import { tutorMoveSchema } from './schemas/moves.schema';

export const realtimeCredentialsSchema = z.object({
  url: z.url(),
  token: z.string().min(1).max(8_192),
  room: z.string().min(1).max(128),
  region: z.string().min(2).max(32),
  expiresAt: timestampSchema,
  processors: z.array(z.string().min(1).max(64)).min(1).max(8),
  connectionEpoch: sequenceSchema,
});

export const voiceTurnRequestSchema = z.object({
  protocolVersion: protocolVersionSchema,
  event: tutorInputEventSchema,
  replayOnly: z.boolean().default(false),
  acknowledgedSeq: sequenceSchema,
  connectionEpoch: sequenceSchema,
});

export const voiceTurnResponseSchema = z.object({
  connectionEpoch: sequenceSchema,
  moves: z.array(tutorMoveSchema).max(128),
});

export const voiceClientEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ACK'), acknowledgedSeq: sequenceSchema }),
  z.object({ kind: z.literal('SPEECH_STARTED') }),
  z.object({ kind: z.literal('SYNC') }),
  z.object({ kind: z.literal('STOP'), generationId: z.string().min(1).max(128) }),
]);

export const voiceWorkerStateSchema = z.discriminatedUnion('kind', [
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
export type VoiceClientEvent = z.infer<typeof voiceClientEventSchema>;
export type VoiceWorkerState = z.infer<typeof voiceWorkerStateSchema>;
export type VoiceMetric = z.infer<typeof voiceMetricSchema>;
export type VoiceMetricRequest = z.infer<typeof voiceMetricRequestSchema>;
