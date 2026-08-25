import type { ContentCacheService } from '@/content/cache/content-cache.service';
import type { FallbackService } from '@/content/fallback/fallback.service';
import type { ContentDraft, ContentLookup, JsonValue } from '@/content/types';
import { ServiceUnavailableError } from '@/errors';
import type { GateInput, GateVerdict, QualityGate } from '@/quality';

export type GeneratedContent = Readonly<{ gateInput: GateInput; draft: ContentDraft }>;
export type ContentResult = Readonly<{
  source: 'cache' | 'generated' | 'fallback';
  itemId: string | null;
  body: JsonValue;
}>;

export type ReliableContentService = Readonly<{
  resolve(input: ContentLookup, signal?: AbortSignal): Promise<ContentResult>;
}>;

export function createReliableContentService(dependencies: {
  cache: ContentCacheService;
  fallback: FallbackService;
  gate: QualityGate;
  generate: (input: ContentLookup, signal?: AbortSignal) => Promise<GeneratedContent>;
  recordFailure: (verdict: Extract<GateVerdict, { verdict: 'fail' }>) => Promise<void>;
}): ReliableContentService {
  return { resolve: (input, signal) => resolve(dependencies, input, signal) };
}

async function resolve(
  dependencies: Parameters<typeof createReliableContentService>[0],
  input: ContentLookup,
  signal?: AbortSignal,
): Promise<ContentResult> {
  throwIfAborted(signal);
  const cached = await dependencies.cache.lookup(input);
  throwIfAborted(signal);
  if (cached !== null) return { source: 'cache', itemId: cached.id, body: cached.body };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const generated = await recoverableGeneration(dependencies.generate, input, signal);
    throwIfAborted(signal);
    if (generated === null) break;
    const verdict = dependencies.gate(generated.gateInput);
    if (verdict.verdict === 'pass') {
      const stored = await dependencies.cache.store(generated.draft, verdict.pass);
      throwIfAborted(signal);
      return { source: 'generated', itemId: stored.id, body: stored.body };
    }
    await dependencies.recordFailure(verdict);
  }

  const fallback = dependencies.fallback.get(input.skillCode);
  if (fallback === null)
    throw new ServiceUnavailableError('No verified content source remained available');
  return { source: 'fallback', itemId: null, body: fallback.definition.body };
}

async function recoverableGeneration(
  generate: (input: ContentLookup, signal?: AbortSignal) => Promise<GeneratedContent>,
  input: ContentLookup,
  signal?: AbortSignal,
): Promise<GeneratedContent | null> {
  try {
    return await generate(input, signal);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return null;
    throw error;
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DOMException('Content generation aborted', 'AbortError');
}
