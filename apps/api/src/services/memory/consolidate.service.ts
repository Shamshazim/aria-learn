import { withTransaction } from '@/db';
import { runQuery } from '@/db/run-query';
import type { Clock } from '@/lib/clock';
import { scrubLearnerContext, type RawIdentifiers } from '@/privacy';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { conflictingFact } from '@/services/memory/decide/conflict';
import { decideProposal } from '@/services/memory/decide/thresholds';
import { proposeFromEvents, type MemoryProposal } from '@/services/memory/propose/from-events';
import { proposeFromModel, type ModelFactProposer } from '@/services/memory/propose/from-model';
import { createMemoryWriteService } from '@/services/memory/write.service';

import type { Pool } from 'pg';

export type ConsolidationService = Readonly<{
  consolidate(sessionId: string, studentId: string): Promise<void>;
}>;

export function createConsolidationService(deps: {
  events: SessionEventRepository;
  memory: LearnerMemoryRepository;
  pool: Pool;
  clock: Clock;
  repetitionsForDurableFact: number;
  countPriorSignal(studentId: string, kind: string): Promise<number>;
  modelProposer?: ModelFactProposer;
  loadIdentifiers?(studentId: string): Promise<RawIdentifiers>;
}): ConsolidationService {
  return { consolidate: (sessionId, studentId) => consolidate(deps, sessionId, studentId) };
}

async function consolidate(
  deps: Parameters<typeof createConsolidationService>[0],
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
    const memory = deps.memory.withDb(tx);
    const current = await memory.listCurrent(studentId, deps.clock.now());
    const proposals = await proposalsForSession(deps, studentId, events);
    for (const proposal of uniqueByKind(proposals)) {
      if (await memory.hasEvidence('session_event', proposal.sourceEventId)) continue;
      await applyProposal(deps, createMemoryWriteService(memory), {
        current,
        studentId,
        proposal,
        countPriorSignal: (kind) => memory.countObservations(studentId, kind),
      });
    }
  });
}

async function proposalsForSession(
  deps: Parameters<typeof createConsolidationService>[0],
  studentId: string,
  events: Awaited<ReturnType<SessionEventRepository['list']>>,
): Promise<readonly MemoryProposal[]> {
  const deterministic = proposeFromEvents(events);
  if (deps.modelProposer === undefined || events.length === 0) return deterministic;
  const identifiers = (await deps.loadIdentifiers?.(studentId)) ?? {};
  const context = scrubLearnerContext(
    {
      identifiers,
      recentEvidence: events
        .flatMap((event) => (event.text === null ? [] : [event.text]))
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

function uniqueByKind(proposals: readonly MemoryProposal[]): readonly MemoryProposal[] {
  const latest = new Map<string, MemoryProposal>();
  for (const proposal of proposals) latest.set(proposal.kind, proposal);
  return [...latest.values()];
}

async function applyProposal(
  deps: Parameters<typeof createConsolidationService>[0],
  writer: ReturnType<typeof createMemoryWriteService>,
  input: Readonly<{
    current: Awaited<ReturnType<LearnerMemoryRepository['listCurrent']>>;
    studentId: string;
    proposal: MemoryProposal;
    countPriorSignal(kind: string): Promise<number>;
  }>,
): Promise<void> {
  const now = deps.clock.now();
  const prior = await input.countPriorSignal(input.proposal.kind);
  const decision = decideProposal({
    proposal: input.proposal,
    repeatedCount: prior + 1,
    repetitionsForDurableFact: deps.repetitionsForDurableFact,
    now,
  });
  if (decision.kind === 'reject') return;
  if (decision.kind === 'observation') {
    await writer.observation({
      studentId: input.studentId,
      proposal: input.proposal,
      at: now,
      expiresAt: decision.expiresAt,
    });
    return;
  }
  if (
    input.current.some(
      (fact) => fact.kind === input.proposal.kind && fact.value.text === input.proposal.text,
    )
  )
    return;
  await writer.fact({
    studentId: input.studentId,
    proposal: input.proposal,
    at: now,
    previous: conflictingFact(
      input.current,
      input.proposal.kind,
      input.proposal.text,
      input.proposal.skillCode,
    ),
  });
}
