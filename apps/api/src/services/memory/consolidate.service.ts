import { withTransaction } from '@/db';
import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import { scrubLearnerContext, type RawIdentifiers } from '@/privacy';
import type { ConsolidationHistoryRepository } from '@/repositories/consolidation-history.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { consolidateSession } from '@/services/memory/consolidate/core';
import { createLiveStore } from '@/services/memory/consolidate/live-store';
import { detectEpisodes, type EpisodeProposal } from '@/services/memory/propose/episodes';
import { proposeFromEvents, type MemoryProposal } from '@/services/memory/propose/from-events';
import { proposeFromModel, type ModelFactProposer } from '@/services/memory/propose/from-model';
import type { SessionEventRecord } from '@/types/session';

import type { Pool } from 'pg';

export type ConsolidationService = Readonly<{
  consolidate(sessionId: string, studentId: string): Promise<void>;
}>;

export type ConsolidationDeps = Readonly<{
  events: SessionEventRepository;
  memory: LearnerMemoryRepository;
  episodes: LearnerEpisodeRepository;
  history: ConsolidationHistoryRepository;
  pool: Pool;
  clock: Clock;
  repetitionsForDurableFact: number;
  modelProposer?: ModelFactProposer;
  loadIdentifiers?(studentId: string): Promise<RawIdentifiers>;
  /** The inventory's name for a skill; `null` for one it no longer has, which is skipped. */
  skillName?(code: string): string | null;
  /** P6-04 supplies a parent's goals; until then there are none to reach. */
  goals?(studentId: string): Promise<readonly Readonly<{ skillCode: string }>[]>;
}>;

/**
 * Post-session consolidation (P1-09, P3-02): orchestration only. It takes the session's lock,
 * gathers what the proposers need, and hands it to the core; every threshold, expiry and
 * conflict rule lives in `decide/`, every detector in `propose/`.
 */
export function createConsolidationService(deps: ConsolidationDeps): ConsolidationService {
  return { consolidate: (sessionId, studentId) => consolidate(deps, sessionId, studentId) };
}

async function consolidate(
  deps: ConsolidationDeps,
  sessionId: string,
  studentId: string,
): Promise<void> {
  await withTransaction(deps.pool, async (tx) => {
    await runQuery({
      db: tx,
      operation: 'memory.consolidate.lock',
      sql: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [sessionId],
    });
    const events = await deps.events.withDb(tx).list(sessionId);
    const history = deps.history.withDb(tx);
    const [proposals, episodes, flaggedEventIds] = await Promise.all([
      proposalsForSession(deps, studentId, events),
      episodesForSession(deps, tx, { studentId, sessionId, events }),
      history.flaggedEventIds(sessionId),
    ]);
    await consolidateSession(createLiveStore(deps, tx, studentId), {
      sessionId,
      proposals,
      episodes,
      flaggedEventIds: withEvidenceFlags(flaggedEventIds, events),
      repetitionsForDurableFact: deps.repetitionsForDurableFact,
      now: deps.clock.now(),
    });
  });
}

async function proposalsForSession(
  deps: ConsolidationDeps,
  studentId: string,
  events: readonly SessionEventRecord[],
): Promise<readonly MemoryProposal[]> {
  const deterministic = proposeFromEvents(events);
  if (deps.modelProposer === undefined || events.length === 0) return deterministic;
  const identifiers = (await deps.loadIdentifiers?.(studentId)) ?? {};
  const context = scrubLearnerContext(
    {
      identifiers,
      recentEvidence: events
        .flatMap((event) => (event.text === null || flagged(event) ? [] : [event.text]))
        .slice(-32),
    },
    { pseudonym: 'omit' },
  );
  const model = await proposeFromModel(deps.modelProposer, {
    context,
    eventIds: events.map((event) => event.id),
  });
  return [...deterministic, ...model];
}

async function episodesForSession(
  deps: ConsolidationDeps,
  tx: Queryable,
  input: Readonly<{ studentId: string; sessionId: string; events: readonly SessionEventRecord[] }>,
): Promise<readonly EpisodeProposal[]> {
  const history = deps.history.withDb(tx);
  const [sessions, attempts, goals] = await Promise.all([
    history.sessionsForStudent(input.studentId),
    history.gradedAttempts(input.studentId),
    deps.goals?.(input.studentId) ?? Promise.resolve([]),
  ]);
  const at = sessions.findIndex((session) => session.id === input.sessionId);
  const session = sessions[at];
  if (session === undefined) return [];
  return detectEpisodes({
    session,
    events: input.events,
    previousSession: sessions[at - 1] ?? null,
    attempts: attempts.filter(
      (attempt) => attempt.at.getTime() <= lastAt(input.events, session.startedAt),
    ),
    goals,
    skillName: deps.skillName ?? (() => null),
    isFacts: (code) => code.includes('.FACT.'),
  });
}

/** Up to this session's last event, so a re-run sees the history it saw the first time. */
function lastAt(events: readonly SessionEventRecord[], fallback: Date): number {
  return (events.at(-1)?.at ?? fallback).getTime();
}

/** The crisis path marks its turns in their evidence as well as in `safety_flag`. */
function withEvidenceFlags(
  flaggedEventIds: ReadonlySet<string>,
  events: readonly SessionEventRecord[],
): ReadonlySet<string> {
  return new Set([...flaggedEventIds, ...events.filter(flagged).map((event) => event.id)]);
}

function flagged(event: SessionEventRecord): boolean {
  return event.evidence.safety !== undefined;
}
