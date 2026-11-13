import type { IdGenerator } from '@/lib/ids';
import { newFact } from '@/services/memory/consolidate/live-store';
import type { MemoryStore } from '@/services/memory/consolidate/store';
import type { EpisodeProposal } from '@/services/memory/propose/episodes';
import type { LearnerFact } from '@/types/memory';
import type { CorrectionRecord } from '@/types/memory-history';

export type ShadowEpisode = EpisodeProposal &
  Readonly<{ id: string; sessionId: string; expiresAt: Date | null; supersededBy: string | null }>;

/** The rebuild's working memory: what the tables would hold if this were the only history. */
export type RebuildStore = MemoryStore &
  Readonly<{
    facts(): readonly LearnerFact[];
    episodes(): readonly ShadowEpisode[];
    /** A correction, applied the way it was applied to the live rows, so a rebuild never un-corrects. */
    applyCorrection(correction: CorrectionRecord): void;
  }>;

type State = {
  readonly studentId: string;
  readonly ids: IdGenerator;
  readonly facts: LearnerFact[];
  readonly episodes: ShadowEpisode[];
  readonly observations: { kind: string; sourceEventId: string }[];
  readonly evidence: Set<string>;
};

/**
 * An in-memory `MemoryStore` (P3-02). The consolidation core runs against it exactly as it runs
 * against the tables; only the writes go nowhere but here.
 */
export function createRebuildStore(studentId: string, ids: IdGenerator): RebuildStore {
  const state: State = {
    studentId,
    ids,
    facts: [],
    episodes: [],
    observations: [],
    evidence: new Set(),
  };
  return {
    currentFacts: (now) => Promise.resolve(state.facts.filter((fact) => live(fact, now))),
    countObservations: (kind) =>
      Promise.resolve(state.observations.filter((item) => item.kind === kind).length),
    consolidated: (sourceEventId) => Promise.resolve(state.evidence.has(sourceEventId)),
    hasEpisode: (kind, sourceEventId) => Promise.resolve(hasEpisode(state, kind, sourceEventId)),
    observe: (proposal) => {
      state.observations.push({ kind: proposal.kind, sourceEventId: proposal.sourceEventId });
      state.evidence.add(proposal.sourceEventId);
      return Promise.resolve();
    },
    insertFact: (proposal, at, expiresAt) =>
      Promise.resolve(insert(state, newFact(studentId, proposal, at, expiresAt))),
    supersedeFact: (previousId, proposal, at, expiresAt) => {
      const next = insert(state, newFact(studentId, proposal, at, expiresAt));
      replace(state, previousId, { supersededBy: next.id });
      return Promise.resolve(next);
    },
    confirmFact: (id, at, expiresAt, sourceEventId) => {
      const held = state.facts.find((fact) => fact.id === id);
      const evidenceCount = (held?.evidenceCount ?? 1) + 1;
      replace(state, id, { lastConfirmedAt: at, expiresAt, evidenceCount });
      state.evidence.add(sourceEventId);
      return Promise.resolve();
    },
    weakenFact: (id, by) => {
      const held = state.facts.find((fact) => fact.id === id);
      if (held !== undefined) {
        replace(state, id, {
          confidence: Math.max(0, Math.round((held.confidence - by) * 100) / 100),
        });
      }
      return Promise.resolve();
    },
    insertEpisode: (episode) => {
      state.episodes.push({ ...episode, id: ids.next(), supersededBy: null });
      return Promise.resolve();
    },
    facts: () => state.facts,
    episodes: () => state.episodes,
    applyCorrection: (correction) => {
      applyCorrection(state, correction);
    },
  };
}

function live(fact: LearnerFact, now: Date): boolean {
  return (
    fact.supersededBy === null &&
    (fact.expiresAt === null || fact.expiresAt.getTime() > now.getTime())
  );
}

function hasEpisode(state: State, kind: string, sourceEventId: string): boolean {
  return state.episodes.some(
    (item) =>
      item.kind === kind && item.evidence.some((source) => source.sourceId === sourceEventId),
  );
}

function insert(state: State, draft: ReturnType<typeof newFact>, corrected = false): LearnerFact {
  const { evidence: sources, ...fields } = draft;
  const fact: LearnerFact = {
    ...fields,
    id: state.ids.next(),
    supersededBy: null,
    corrected,
    evidenceCount: sources.length,
  };
  state.facts.push(fact);
  for (const source of sources) state.evidence.add(source.sourceId);
  return fact;
}

function replace(state: State, id: string, next: Partial<LearnerFact>): void {
  const index = state.facts.findIndex((fact) => fact.id === id);
  const held = state.facts[index];
  if (held !== undefined) state.facts.splice(index, 1, { ...held, ...next });
}

function applyCorrection(state: State, correction: CorrectionRecord): void {
  const oldText = correction.oldValue.text;
  const oldSummary = correction.oldValue.summary;
  if (correction.targetKind === 'fact' && typeof oldText === 'string')
    correctFact(state, correction, oldText);
  if (correction.targetKind === 'episode' && typeof oldSummary === 'string') {
    correctEpisode(state, correction, oldSummary);
  }
}

/** Found by what it said, since a shadow row has a different id from the live row corrected. */
function correctFact(state: State, correction: CorrectionRecord, oldText: string): void {
  const target = state.facts.find(
    (fact) => live(fact, correction.at) && fact.value.text === oldText,
  );
  if (target === undefined) return;
  const newText = correction.newValue?.text;
  if (typeof newText !== 'string') {
    replace(state, target.id, { expiresAt: correction.at });
    return;
  }
  const draft = newFact(
    state.studentId,
    {
      kind: target.kind,
      text: newText,
      confidence: correction.correctedBy === 'child' ? 0.8 : 1,
      temporary: false,
      sensitive: false,
      sourceEventId: correction.id,
      skillCode: null,
    },
    correction.at,
    null,
  );
  const next = insert(
    state,
    {
      ...draft,
      value: { ...target.value, text: newText },
      firstObservedAt: target.firstObservedAt,
    },
    true,
  );
  replace(state, target.id, { supersededBy: next.id });
}

function correctEpisode(state: State, correction: CorrectionRecord, oldSummary: string): void {
  const index = state.episodes.findIndex(
    (item) => item.supersededBy === null && item.summary === oldSummary,
  );
  const target = state.episodes[index];
  if (target === undefined) return;
  const newSummary = correction.newValue?.summary;
  if (typeof newSummary !== 'string') {
    state.episodes.splice(index, 1, { ...target, expiresAt: correction.at });
    return;
  }
  const id = state.ids.next();
  state.episodes.push({ ...target, id, summary: newSummary, supersededBy: null });
  state.episodes.splice(index, 1, { ...target, supersededBy: id });
}
