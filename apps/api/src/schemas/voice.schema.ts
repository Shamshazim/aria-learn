import { z } from 'zod';

import {
  bandSchema,
  voiceHeardRequestSchema,
  voiceMetricRequestSchema,
  voiceSpokenRequestSchema,
  voiceTurnRequestSchema,
} from '@aria/shared';

export const realtimeParamsSchema = z.object({ id: z.uuid() }).strict();

export const voiceConsentSchema = z
  .object({
    parentId: z.uuid(),
    studentId: z.uuid(),
    processorCategories: z.array(z.enum(['media', 'stt', 'tts'])).length(3),
    retainReadingAudio: z.literal(false).default(false),
    verificationReference: z.string().trim().min(3).max(128),
  })
  .strict();

export const voiceConsentWithdrawSchema = z
  .object({ parentId: z.uuid(), studentId: z.uuid() })
  .strict();

/** P2H-09: a worker may only ask for the library of the band and voice it is running. */
export const bridgeLibraryQuerySchema = z
  .object({ band: bandSchema, voice: z.string().trim().min(1).max(64) })
  .strict();

export const bridgeAudioParamsSchema = z.object({ assetId: z.uuid() }).strict();

export const workerVoiceTurnSchema = voiceTurnRequestSchema;
export const workerVoiceMetricSchema = voiceMetricRequestSchema;

/** "Aria talks": the worker's brief, and the two halves of the transcript it reports. */
export const workerBriefQuerySchema = z
  .object({ connectionEpoch: z.coerce.number().int().nonnegative() })
  .strict();
export const workerHeardSchema = voiceHeardRequestSchema;
export const workerSpokenSchema = voiceSpokenRequestSchema;

export type VoiceConsentRequest = z.infer<typeof voiceConsentSchema>;
export type VoiceConsentWithdrawRequest = z.infer<typeof voiceConsentWithdrawSchema>;
