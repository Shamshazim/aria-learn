import { z } from 'zod';

import { voiceMetricRequestSchema, voiceTurnRequestSchema } from '@aria/shared';

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

export const workerVoiceTurnSchema = voiceTurnRequestSchema;
export const workerVoiceMetricSchema = voiceMetricRequestSchema;

export type VoiceConsentRequest = z.infer<typeof voiceConsentSchema>;
export type VoiceConsentWithdrawRequest = z.infer<typeof voiceConsentWithdrawSchema>;
