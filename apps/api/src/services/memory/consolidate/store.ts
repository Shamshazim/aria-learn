import type { EpisodeProposal } from '@/services/memory/propose/episodes';
import type { MemoryProposal } from '@/services/memory/propose/from-events';
import type { LearnerFact } from '@/types/memory';

/**
 * Where consolidation writes (P3-02). The live store is the real tables inside one transaction;
 * the rebuild store is an in-memory set that becomes the shadow tables. One core drives both,
 * so a rebuild is the same rules applied again — which is the only way its drift means
 * anything.
 */
export type MemoryStore = Readonly<{
  currentFacts(now: Date): Promise<readonly LearnerFact[]>;
  countObservations(kind: string): Promise<number>;
  /** This event already backs a fact or an observation: it has been consolidated. */
  consolidated(sourceEventId: string): Promise<boolean>;
  /** An episode of this kind already rests on this event. */
  hasEpisode(kind: EpisodeProposal['kind'], sourceEventId: string): Promise<boolean>;
  observe(proposal: MemoryProposal, at: Date, expiresAt: Date): Promise<void>;
  insertFact(proposal: MemoryProposal, at: Date, expiresAt: Date | null): Promise<LearnerFact>;
  supersedeFact(
    previousId: string,
    proposal: MemoryProposal,
    at: Date,
    expiresAt: Date | null,
  ): Promise<LearnerFact>;
  confirmFact(id: string, at: Date, expiresAt: Date | null, sourceEventId: string): Promise<void>;
  weakenFact(id: string, by: number): Promise<void>;
  insertEpisode(
    input: EpisodeProposal & Readonly<{ sessionId: string; expiresAt: Date | null }>,
  ): Promise<void>;
}>;
