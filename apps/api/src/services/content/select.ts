import type { ContentItem } from '@/content';

export function selectContent(
  candidates: readonly ContentItem[],
  recentlySeenIds: readonly string[],
): ContentItem | null {
  const recent = new Set(recentlySeenIds);
  return (
    [...candidates].sort((left, right) => {
      const leftRecent = recent.has(left.id) ? 1 : 0;
      const rightRecent = recent.has(right.id) ? 1 : 0;
      return (
        leftRecent - rightRecent ||
        left.timesUsed - right.timesUsed ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id)
      );
    })[0] ?? null
  );
}
