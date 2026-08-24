import type { ContentCacheService } from '@/content/cache/content-cache.service';
import type { FallbackService } from '@/content/fallback/fallback.service';
import type { ContentDraft, ContentLookup, JsonValue } from '@/content/types';
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

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const generated = await dependencies.generate(input);
      const verdict = dependencies.gate(generated.gateInput);
      if (verdict.verdict === 'pass') {
        const stored = await dependencies.cache.store(generated.draft, verdict.pass);
        return { source: 'generated', body: stored.body };
      }
      await dependencies.recordFailure(verdict);
    }
  } catch {
    // Provider exhaustion and cap trips both move directly to the already verified bank.
  }

  const fallback = dependencies.fallback.get(input.skillCode);
  return { source: 'fallback', body: fallback.definition.body };
}
