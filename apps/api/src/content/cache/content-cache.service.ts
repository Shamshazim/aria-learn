import type { AiAccounting } from '@/ai';
import { mayServeTo, personalisedFor } from '@/content/cache/eligibility';
import type { ContentDraft, ContentItem, ContentLookup } from '@/content/types';
import type { GatePass } from '@/quality';
import type { ContentItemRepository } from '@/repositories/content-item.repository';

export type ContentCacheService = Readonly<{
  lookup(input: ContentLookup): Promise<ContentItem | null>;
  store(draft: ContentDraft, pass: GatePass): Promise<ContentItem>;
}>;

export function createContentCacheService(dependencies: {
  repository: ContentItemRepository;
  accounting: AiAccounting;
}): ContentCacheService {
  return {
    lookup: (input) => lookup(dependencies, input),
    store: (draft, _pass) => dependencies.repository.insert(draft, personalisedFor(draft.scope)),
  };
}

async function lookup(
  dependencies: Parameters<typeof createContentCacheService>[0],
  input: ContentLookup,
): Promise<ContentItem | null> {
  const item = await dependencies.repository.findEligible(input);
  if (item === null || !mayServeTo(item.personalisedFor, input.studentId)) return null;
  await dependencies.repository.markUsed(item.id);
  await dependencies.accounting.recordCachedHit({
    studentId: input.studentId,
    tier: 'FAST',
    ...(item.promptName === null ? {} : { promptName: item.promptName }),
    ...(item.promptVersion === null ? {} : { promptVersion: item.promptVersion }),
  });
  return item;
}
