import type { MemoryProposal } from '@/services/memory/propose/from-events';
import type { LearnerFact } from '@/types/memory';

/** Rule 2's tolerance: newer evidence wins when it is at most this much less sure. */
const CONFIDENCE_TOLERANCE = 0.1;
/** Rule 3: memory this well supported is not overturned by one contradiction. */
const WELL_SUPPORTED = 3;
/** Rule 3: what a lone contradiction costs it instead. */
export const CONTRADICTION_PENALTY = 0.1;

/** The current fact of the same kind (and skill) that a proposal would replace, if any. */
export function conflictingFact(
  current: readonly LearnerFact[],
  kind: string,
  text: string,
  skillCode: string | null,
): LearnerFact | null {
  return (
    current.find(
      (fact) =>
        fact.kind === kind &&
        (typeof fact.value.skillCode === 'string' ? fact.value.skillCode : null) === skillCode &&
        fact.value.text !== text,
    ) ?? null
  );
}

/** The current fact that already says exactly this, if any. */
export function sameFact(
  current: readonly LearnerFact[],
  proposal: MemoryProposal,
): LearnerFact | null {
  return (
    current.find((fact) => fact.kind === proposal.kind && fact.value.text === proposal.text) ?? null
  );
}

export type Resolution =
  | Readonly<{ action: 'insert' }>
  | Readonly<{ action: 'confirm'; fact: LearnerFact }>
  | Readonly<{ action: 'supersede'; previous: LearnerFact }>
  | Readonly<{ action: 'weaken'; fact: LearnerFact }>
  | Readonly<{ action: 'keep'; reason: 'corrected' | 'less_sure' }>;

/**
 * What a durable proposal does to current memory (P3-02), in order:
 *
 * 1. A fact a correction made is never replaced by consolidation — only another correction.
 * 2. Newer evidence replaces older when it is at most 0.1 less sure.
 * 3. A single contradiction against a fact with three or more evidence rows does not replace
 *    it: it is kept as an observation and the fact loses 0.1 confidence.
 * (4. Two proposals of one kind in a run: the surer wins — `strongestByKind`.)
 *
 * The same thing said again confirms the fact rather than duplicating it.
 */
export function resolveConflict(
  current: readonly LearnerFact[],
  proposal: MemoryProposal,
): Resolution {
  const same = sameFact(current, proposal);
  if (same !== null) return { action: 'confirm', fact: same };
  const previous = conflictingFact(current, proposal.kind, proposal.text, proposal.skillCode);
  if (previous === null) return { action: 'insert' };
  if (previous.corrected === true) return { action: 'keep', reason: 'corrected' };
  if ((previous.evidenceCount ?? 1) >= WELL_SUPPORTED) return { action: 'weaken', fact: previous };
  if (proposal.confidence >= previous.confidence - CONFIDENCE_TOLERANCE) {
    return { action: 'supersede', previous };
  }
  return { action: 'keep', reason: 'less_sure' };
}

/** Rule 4: one proposal per kind per run — the surest, the earliest on a tie. */
export function strongestByKind(proposals: readonly MemoryProposal[]): readonly MemoryProposal[] {
  const best = new Map<string, MemoryProposal>();
  for (const proposal of proposals) {
    const held = best.get(proposal.kind);
    if (held === undefined || proposal.confidence > held.confidence)
      best.set(proposal.kind, proposal);
  }
  return [...best.values()];
}
