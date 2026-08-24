import { z } from 'zod';

import { BANDS } from '@aria/shared';

import { jsonValueSchema } from '@/content/json.schema';
import type { ContentItem, ContentKind } from '@/content/types';

const CONTENT_KINDS = [
  'question',
  'explanation',
  'passage',
  'writing-prompt',
  'activity',
] as const satisfies readonly ContentKind[];

const rowSchema = z.object({
  id: z.uuid(),
  kind: z.enum(CONTENT_KINDS),
  skill_code: z.string().min(1).max(32),
  band: z.enum(BANDS),
  body: jsonValueSchema,
  quality_score: z.string().nullable(),
  source_model: z.string().nullable(),
  prompt_name: z.string().nullable(),
  prompt_version: z.string().nullable(),
  personalised_for: z.uuid().nullable(),
  verified_at: z.date(),
  times_used: z.number().int().nonnegative(),
  created_at: z.date(),
});

export type ContentItemRow = z.input<typeof rowSchema>;

export function toContentItem(value: unknown): ContentItem {
  const row = rowSchema.parse(value);
  return {
    id: row.id,
    kind: row.kind,
    skillCode: row.skill_code,
    band: row.band,
    body: row.body,
    qualityScore: row.quality_score === null ? null : Number(row.quality_score),
    sourceModel: row.source_model,
    promptName: row.prompt_name,
    promptVersion: row.prompt_version,
    personalisedFor: row.personalised_for,
    verifiedAt: row.verified_at,
    timesUsed: row.times_used,
    createdAt: row.created_at,
  };
}
