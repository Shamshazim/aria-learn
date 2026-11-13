import {
  CONTRADICTION_PENALTY,
  resolveConflict,
  strongestByKind,
} from '@/services/memory/decide/conflict';
import {
  episodeExpiresAt,
  factExpiresAt,
  observationExpiresAt,
} from '@/services/memory/decide/expiry';
import { isPromotable } from '@/services/memory/decide/sensitivity';
import { decideProposal } from '@/services/memory/decide/thresholds';
import { preferenceChange, type EpisodeProposal } from '@/services/memory/propose/episodes';
import type { MemoryProposal } from '@/services/memory/propose/from-events';
import type { LearnerFact } from '@/types/memory';

import type { MemoryStore } from './store';

export type SessionConsolidation = Readonly<{
  sessionId: string;
  proposals: readonly MemoryProposal[];
  episodes: readonly EpisodeProposal[];
  /** Events the safety layer flagged; nothing from them is remembered. */
  flaggedEventIds: ReadonlySet<string>;
  repetitionsForDurableFact: number;
  now: Date;
}>;

/**
 * One session's memory, applied to a store (P3-02). Idempotent: anything an event already
 * backs is skipped, so a second run for the same session writes nothing and a late event is
 * picked up on its own. Every rule lives in `decide/` and `propose/`; this only applies them.
 */
export async function consolidateSession(
  store: MemoryStore,
  input: SessionConsolidation,
): Promise<void> {
  const current = [...(await store.currentFacts(input.now))];
  const changes: EpisodeProposal[] = [];
  for (const proposal of strongestByKind(input.proposals)) {
    if (await store.consolidated(proposal.sourceEventId)) continue;
    if (!isPromotable(proposal, input.flaggedEventIds)) continue;
    const change = await applyProposal(store, current, proposal, input);
    if (change !== null) changes.push(change);
  }
  for (const episode of [...input.episodes, ...changes]) {
    if (input.flaggedEventIds.has(episode.evidence[0].sourceId)) continue;
    if (await store.hasEpisode(episode.kind, episode.evidence[0].sourceId)) continue;
    await store.insertEpisode({
      ...episode,
      sessionId: input.sessionId,
      expiresAt: episodeExpiresAt(episode.kind, episode.at),
    });
  }
}

/** The proposal's effect on memory; a changed preference comes back as a moment to record. */
async function applyProposal(
  store: MemoryStore,
  current: LearnerFact[],
  proposal: MemoryProposal,
  input: SessionConsolidation,
): Promise<EpisodeProposal | null> {
  const { now } = input;
  const decision = decideProposal({
    proposal,
    repeatedCount: (await store.countObservations(proposal.kind)) + 1,
    repetitionsForDurableFact: input.repetitionsForDurableFact,
    now,
  });
  if (decision.kind === 'reject') return null;
  if (decision.kind === 'observation') {
    await store.observe(proposal, now, decision.expiresAt);
    return null;
  }
  const expires = factExpiresAt(proposal.kind, now);
  const resolution = resolveConflict(current, proposal);
  switch (resolution.action) {
    case 'insert':
      current.push(await store.insertFact(proposal, now, expires));
      return null;
    case 'confirm':
      await store.confirmFact(resolution.fact.id, now, expires, proposal.sourceEventId);
      return null;
    case 'supersede': {
      const next = await store.supersedeFact(resolution.previous.id, proposal, now, expires);
      current.splice(current.indexOf(resolution.previous), 1, next);
      return proposal.kind === 'preference'
        ? preferenceChange(proposal.text, proposal.sourceEventId, now)
        : null;
    }
    case 'weaken':
      await store.weakenFact(resolution.fact.id, CONTRADICTION_PENALTY);
      await store.observe(proposal, now, observationExpiresAt(now, proposal.temporary));
      return null;
    default:
      // Kept as a signal: a contradiction that did not win is still worth seeing again.
      await store.observe(proposal, now, observationExpiresAt(now, proposal.temporary));
      return null;
  }
}
