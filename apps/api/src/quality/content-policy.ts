import type { QualityGate } from '@/quality/gate';
import type { GateInput, GatePass, GateVerdict } from '@/quality/gate.types';

export type VerifiedContent = Readonly<{ content: GateInput; pass: GatePass }>;
export type ResolvedContent = VerifiedContent & Readonly<{ source: 'generated' | 'fallback' }>;

export type ContentPolicyDependencies = Readonly<{
  generate: () => Promise<GateInput>;
  gate: QualityGate;
  fallback: () => Promise<VerifiedContent>;
  recordFailure: (verdict: Extract<GateVerdict, { verdict: 'fail' }>) => Promise<void>;
}>;

/** Tries one regeneration, then returns only previously verified fallback content. */
export async function resolveGatedContent(
  dependencies: ContentPolicyDependencies,
): Promise<ResolvedContent> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await dependencies.generate();
    const verdict = dependencies.gate(content);
    if (verdict.verdict === 'pass') {
      return { content, pass: verdict.pass, source: 'generated' };
    }
    await dependencies.recordFailure(verdict);
  }
  const fallback = await dependencies.fallback();
  return { ...fallback, source: 'fallback' };
}
