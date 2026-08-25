import type { Band } from '@aria/shared';

import type { JsonValue } from '@/content/json.schema';

export type { JsonValue } from '@/content/json.schema';

export type ContentKind = 'question' | 'explanation' | 'passage' | 'writing-prompt' | 'activity';

export type ContentScope =
  Readonly<{ kind: 'shareable' }> | Readonly<{ kind: 'personalised'; studentId: string }>;

export type ContentDraft = Readonly<{
  kind: ContentKind;
  skillCode: string;
  band: Band;
  body: JsonValue;
  qualityScore?: number;
  sourceModel?: string;
  promptName?: string;
  promptVersion?: string;
  scope: ContentScope;
}>;

export type ContentItem = Readonly<{
  id: string;
  kind: ContentKind;
  skillCode: string;
  band: Band;
  body: JsonValue;
  qualityScore: number | null;
  sourceModel: string | null;
  promptName: string | null;
  promptVersion: string | null;
  personalisedFor: string | null;
  verifiedAt: Date;
  timesUsed: number;
  createdAt: Date;
}>;

export type ContentLookup = Readonly<{
  kind: ContentKind;
  skillCode: string;
  band: Band;
  studentId: string;
  excludeIds?: readonly string[];
}>;
