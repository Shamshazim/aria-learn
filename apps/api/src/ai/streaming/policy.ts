import type { StreamContentKind } from '@/ai/streaming/types';

const STREAMING_KINDS = new Set<StreamContentKind>(['explanation']);

/** Unknown kinds buffer by default; only an explicit allow-list may sentence-stream. */
export function mayStreamBySentence(kind: StreamContentKind): boolean {
  return STREAMING_KINDS.has(kind);
}
