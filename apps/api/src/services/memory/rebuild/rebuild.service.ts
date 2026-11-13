import { withTransaction } from '@/db';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { ConsolidationHistoryRepository } from '@/repositories/consolidation-history.repository';
import type { FactCorrectionRepository } from '@/repositories/fact-correction.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { MemoryShadowRepository } from '@/repositories/memory-shadow.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { consolidateSession } from '@/services/memory/consolidate/core';
import { detectEpisodes } from '@/services/memory/propose/episodes';
import { proposeFromEvents } from '@/services/memory/propose/from-events';
import type { CorrectionRecord } from '@/types/memory-history';

import { driftReport, type DriftReport } from './drift.report';
import { createRebuildStore, type RebuildStore } from './memory-store';

import type { Pool } from 'pg';

export type RebuildResult = Readonly<{ runId: string; report: DriftReport }>;

export type RebuildService = Readonly<{
  rebuild(studentId: string): Promise<RebuildResult>;
  rebuildAll(): Promise<readonly Readonly<{ studentId: string } & RebuildResult>[]>;
}>;

export type RebuildDeps = Readonly<{
  pool: Pool;
  events: SessionEventRepository;
  history: ConsolidationHistoryRepository;
  memory: LearnerMemoryRepository;
  episodes: LearnerEpisodeRepository;
  corrections: FactCorrectionRepository;
  shadow: MemoryShadowRepository;
  ids: IdGenerator;
  clock: Clock;
  repetitionsForDurableFact: number;
  skillName(code: string): string | null;
}>;

/**
 * The rebuild (P3-02, `master-plan.md` §4.2: memory is "periodically rebuilt from the raw log
 * so summary drift can be detected").
 *
 * Every session is replayed, in order, through the same deterministic proposers and the same
 * consolidation core into an in-memory store; corrections are re-applied at the moment they
 * were made, so a rebuild never un-corrects. The result goes to the shadow tables under one
 * run, and the run records how far live memory has drifted from it. Nothing here writes to a
 * live table. One session's events are held at a time, so memory stays bounded by the largest
 * session rather than by the child's whole history.
 *
 * The model proposer is not replayed: it is not deterministic, and a rebuild that disagreed
 * with itself would measure nothing. Facts only a model proposed therefore show up as drift,
 * which is the honest reading — they are not derivable from the log by rule.
 */
export function createRebuildService(deps: RebuildDeps): RebuildService {
  const rebuild = (studentId: string): Promise<RebuildResult> => rebuildStudent(deps, studentId);
  return {
    rebuild,
    rebuildAll: async () => {
      const results = [];
      for (const studentId of await deps.shadow.studentIds()) {
        results.push({ studentId, ...(await rebuild(studentId)) });
      }
      return results;
    },
  };
}

async function rebuildStudent(deps: RebuildDeps, studentId: string): Promise<RebuildResult> {
  return withTransaction(deps.pool, async (tx) => {
    const shadow = deps.shadow.withDb(tx);
    await shadow.lockStudent(studentId);
    const runId = deps.ids.next();
    const startedAt = deps.clock.now();
    await shadow.startRun({ id: runId, studentId, at: startedAt });
    const store = await replay(deps, tx, studentId);
    const now = deps.clock.now();
    const facts = store.facts().filter((fact) => current(fact, now));
    const episodes = store.episodes().filter((episode) => current(episode, now));
    await shadow.saveFacts(
      runId,
      studentId,
      facts.map((fact) => ({ ...fact, corrected: fact.corrected === true })),
    );
    await shadow.saveEpisodes(
      runId,
      studentId,
      episodes.map((episode) => ({ ...episode, sourceSessionId: episode.sessionId })),
    );
    const [liveFacts, liveEpisodes] = await Promise.all([
      deps.memory.withDb(tx).listCurrent(studentId, now),
      deps.episodes.withDb(tx).listCurrent(studentId, now),
    ]);
    const report = driftReport(
      [...facts.map(factKey), ...episodes.map(episodeKey)],
      [...liveFacts.map(factKey), ...liveEpisodes.map(episodeKey)],
    );
    await shadow.finishRun(runId, { at: deps.clock.now(), driftScore: report.driftScore, report });
    return { runId, report };
  });
}

async function replay(
  deps: RebuildDeps,
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  studentId: string,
): Promise<RebuildStore> {
  const history = deps.history.withDb(tx);
  const store = createRebuildStore(studentId, deps.ids);
  const [sessions, attempts, corrections] = await Promise.all([
    history.sessionsForStudent(studentId),
    history.gradedAttempts(studentId),
    deps.corrections.withDb(tx).listForStudent(studentId),
  ]);
  const pending = [...corrections].sort((left, right) => left.at.getTime() - right.at.getTime());
  for (const [index, session] of sessions.entries()) {
    applyBefore(store, pending, session.startedAt);
    const events = await deps.events.withDb(tx).list(session.id);
    const last = (events.at(-1)?.at ?? session.startedAt).getTime();
    const flagged = new Set([
      ...(await history.flaggedEventIds(session.id)),
      ...events.filter((event) => event.evidence.safety !== undefined).map((event) => event.id),
    ]);
    await consolidateSession(store, {
      sessionId: session.id,
      proposals: proposeFromEvents(events),
      episodes: detectEpisodes({
        session,
        events,
        previousSession: sessions[index - 1] ?? null,
        attempts: attempts.filter((attempt) => attempt.at.getTime() <= last),
        goals: [],
        skillName: deps.skillName,
        isFacts: (code) => code.includes('.FACT.'),
      }),
      flaggedEventIds: flagged,
      repetitionsForDurableFact: deps.repetitionsForDurableFact,
      now: new Date(last),
    });
  }
  applyBefore(store, pending, new Date(8_640_000_000_000_000));
  return store;
}

/** Corrections made before this moment, applied in the order they were made. */
function applyBefore(store: RebuildStore, pending: CorrectionRecord[], before: Date): void {
  while (pending[0] !== undefined && pending[0].at.getTime() <= before.getTime()) {
    const next = pending.shift();
    if (next !== undefined) store.applyCorrection(next);
  }
}

function current(
  row: Readonly<{ supersededBy: string | null; expiresAt: Date | null }>,
  now: Date,
): boolean {
  return (
    row.supersededBy === null && (row.expiresAt === null || row.expiresAt.getTime() > now.getTime())
  );
}

function factKey(fact: Readonly<{ kind: string; value: Readonly<Record<string, unknown>> }>) {
  return { kind: fact.kind, text: typeof fact.value.text === 'string' ? fact.value.text : '' };
}

function episodeKey(episode: Readonly<{ kind: string; summary: string }>) {
  return { kind: `episode:${episode.kind}`, text: episode.summary };
}
