import type { Queryable } from '@/db/types';
import type { ConsolidationHistoryRepository } from '@/repositories/consolidation-history.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { MemoryProposal } from '@/services/memory/propose/from-events';
import type { NewLearnerFact } from '@/types/memory';

import type { MemoryStore } from './store';

/** The real tables, bound to one transaction (P3-02). */
export function createLiveStore(
  deps: Readonly<{
    memory: LearnerMemoryRepository;
    episodes: LearnerEpisodeRepository;
    history: ConsolidationHistoryRepository;
  }>,
  tx: Queryable,
  studentId: string,
): MemoryStore {
  const memory = deps.memory.withDb(tx);
  const episodes = deps.episodes.withDb(tx);
  const history = deps.history.withDb(tx);
  return {
    currentFacts: (now) => memory.listCurrent(studentId, now),
    countObservations: (kind) => memory.countObservations(studentId, kind),
    consolidated: (sourceEventId) => memory.hasEvidence('session_event', sourceEventId),
    hasEpisode: (kind, sourceEventId) => history.hasEpisode(kind, sourceEventId),
    observe: async (proposal, at, expiresAt) => {
      await memory.insertObservation({
        studentId,
        at,
        skillCode: proposal.skillCode,
        kind: proposal.kind,
        note: proposal.text,
        confidence: proposal.confidence,
        expiresAt,
        sourceEventId: proposal.sourceEventId,
      });
    },
    insertFact: (proposal, at, expiresAt) =>
      memory.insertFact(newFact(studentId, proposal, at, expiresAt)),
    supersedeFact: (previousId, proposal, at, expiresAt) =>
      memory.supersede(previousId, newFact(studentId, proposal, at, expiresAt)),
    confirmFact: (id, at, expiresAt, sourceEventId) =>
      memory.confirm(id, {
        at,
        expiresAt,
        evidence: { sourceKind: 'session_event', sourceId: sourceEventId },
      }),
    weakenFact: (id, by) => memory.weaken(id, by),
    insertEpisode: async (episode) => {
      await episodes.insert({
        studentId,
        at: episode.at,
        kind: episode.kind,
        summary: episode.summary,
        importance: episode.importance,
        skillCode: episode.skillCode,
        sourceSessionId: episode.sessionId,
        sensitivity: 'normal',
        modelShareable: true,
        expiresAt: episode.expiresAt,
        evidence: episode.evidence,
      });
    },
  };
}

export function newFact(
  studentId: string,
  proposal: MemoryProposal,
  at: Date,
  expiresAt: Date | null,
): NewLearnerFact {
  return {
    studentId,
    kind: proposal.kind,
    value: { text: proposal.text, skillCode: proposal.skillCode },
    confidence: proposal.confidence,
    firstObservedAt: at,
    lastConfirmedAt: at,
    expiresAt,
    sensitivity: 'normal',
    modelShareable: true,
    evidence: [{ sourceKind: 'session_event', sourceId: proposal.sourceEventId }],
  };
}
