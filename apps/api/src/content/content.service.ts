import type { ContentCacheService } from '@/content/cache/content-cache.service';
import type { FallbackService } from '@/content/fallback/fallback.service';
import type { ContentDraft, ContentLookup, JsonValue } from '@/content/types';
import { ServiceUnavailableError } from '@/errors';
import type { GateInput, GateVerdict, QualityGate } from '@/quality';

export type GeneratedContent = Readonly<{ gateInput: GateInput; draft: ContentDraft }>;
export type ContentResult = Readonly<{
  source: 'cache' | 'generated' | 'fallback';
  body: JsonValue;
}>;

export type ReliableContentService = Readonly<{
  resolve(input: ContentLookup): Promise<ContentResult>;
}>;

export function createReliableContentService(dependencies: {
  cache: ContentCacheService;
  fallback: FallbackService;
  gate: QualityGate;
  generate: (input: ContentLookup) => Promise<GeneratedContent>;
  recordFailure: (verdict: Extract<GateVerdict, { verdict: 'fail' }>) => Promise<void>;
}): ReliableContentService {
  return { resolve: (input) => resolve(dependencies, input) };
}

async function resolve(
  dependencies: Parameters<typeof createReliableContentService>[0],
  input: ContentLookup,
): Promise<ContentResult> {
  const cached = await dependencies.cache.lookup(input);
  if (cached !== null) return { source: 'cache', body: cached.body };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const generated = await recoverableGeneration(dependencies.generate, input);
    if (generated === null) break;
    const verdict = dependencies.gate(generated.gateInput);
    if (verdict.verdict === 'pass') {
      const stored = await dependencies.cache.store(generated.draft, verdict.pass);
      return { source: 'generated', body: stored.body };
    }
    await dependencies.recordFailure(verdict);
  }

  const fallback = dependencies.fallback.get(input.skillCode);
  if (fallback === null)
    throw new ServiceUnavailableError('No verified content source remained available');
  return { source: 'fallback', body: fallback.definition.body };
}

async function recoverableGeneration(
  generate: (input: ContentLookup) => Promise<GeneratedContent>,
  input: ContentLookup,
): Promise<GeneratedContent | null> {
  try {
    return await generate(input);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return null;
    throw error;
  }
}
