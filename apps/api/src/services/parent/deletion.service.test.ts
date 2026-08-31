import { describe, expect, it } from 'vitest';

import { ServiceUnavailableError } from '@/errors';
import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import type { Parent } from '@/types/parent';
import type { DeletionRequest, DeletionStage } from '@/types/parent-access';

import { createDeletionService, type DeletionServiceDeps } from './deletion.service';

/**
 * The property under test is durability, not happiness: a deletion that reaches the provider
 * is easy, and a deletion that does not is the reason this table exists.
 */
const NOW = new Date('2026-04-02T10:00:00.000Z');
const PARENT: Parent = {
  id: 'parent-1',
  email: 'grown.up@example.test',
  supabaseUserId: 'supabase-1',
  displayName: 'Parent',
  createdAt: NOW,
};

type Ledger = Map<string, DeletionRequest>;

function fakeLedger(): DeletionServiceDeps['ledger'] & Readonly<{ rows: Ledger }> {
  const rows: Ledger = new Map();
  const repository: DeletionServiceDeps['ledger'] = {
    withDb: () => repository,
    open: (input) => {
      const row: DeletionRequest = {
        ...input,
        stage: 'requested',
        requestedAt: input.at,
        updatedAt: input.at,
        attempts: 0,
        lastError: null,
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
    advance: (id, stage: DeletionStage, at) => {
      const row = rows.get(id);
      if (row !== undefined) rows.set(id, { ...row, stage, updatedAt: at, lastError: null });
      return Promise.resolve();
    },
    fail: (id, reason, at) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, {
          ...row,
          stage: 'failed',
          attempts: row.attempts + 1,
          lastError: reason,
          updatedAt: at,
        });
      }
      return Promise.resolve();
    },
    listUnfinished: (limit) =>
      Promise.resolve([...rows.values()].filter((row) => row.stage !== 'complete').slice(0, limit)),
    findById: (id) => Promise.resolve(rows.get(id) ?? null),
  };
  return Object.assign(repository, { rows });
}

function build(options: Readonly<{ directoryFails?: boolean }> = {}) {
  const ledger = fakeLedger();
  const deletedStudents: string[] = [];
  const deletedParents: string[] = [];
  const deletedSubjects: string[] = [];

  const deps: DeletionServiceDeps = {
    ledger,
    students: {
      deleteById: (id, parentId) => {
        deletedStudents.push(`${id}@${parentId}`);
        return Promise.resolve(id === 'child-1');
      },
      listByParentId: () => Promise.resolve([]),
    },
    parents: {
      findById: (id) => Promise.resolve(id === PARENT.id ? PARENT : null),
      deleteById: (id) => {
        deletedParents.push(id);
        return Promise.resolve(true);
      },
    },
    consents: { withdrawAll: () => Promise.resolve(1) },
    directory: {
      deleteUser: (subject) => {
        if (options.directoryFails === true) {
          return Promise.reject(new ServiceUnavailableError('provider down'));
        }
        deletedSubjects.push(subject);
        return Promise.resolve();
      },
    },
    clock: fixedClock(NOW),
    ids: sequentialUuids(),
    logger: createLogger({ level: 'silent' }),
  };

  return {
    service: createDeletionService(deps),
    ledger,
    deletedStudents,
    deletedParents,
    deletedSubjects,
  };
}

describe('deleting one child', () => {
  it('erases the row and completes in a single step', async () => {
    const { service, deletedStudents, ledger } = build();

    const request = await service.deleteChild({ parentId: PARENT.id, studentId: 'child-1' });

    expect(deletedStudents).toEqual(['child-1@parent-1']);
    expect(request.stage).toBe('complete');
    expect([...ledger.rows.values()][0]?.stage).toBe('complete');
  });

  // A child is not a provider user, so there is nothing on the vendor's side to owe.
  it('never calls the provider', async () => {
    const { service, deletedSubjects } = build();

    await service.deleteChild({ parentId: PARENT.id, studentId: 'child-1' });

    expect(deletedSubjects).toEqual([]);
  });

  it('refuses a child who is not this parent’s, and records the refusal', async () => {
    const { service, ledger } = build();

    await expect(
      service.deleteChild({ parentId: PARENT.id, studentId: 'child-elsewhere' }),
    ).rejects.toThrow(/not found/);

    expect([...ledger.rows.values()][0]?.stage).toBe('failed');
  });
});

describe('deleting an account', () => {
  it('erases locally and then at the provider', async () => {
    const { service, deletedParents, deletedSubjects } = build();

    const request = await service.deleteAccount({ parentId: PARENT.id });

    expect(deletedParents).toEqual([PARENT.id]);
    expect(deletedSubjects).toEqual([PARENT.supabaseUserId]);
    expect(request.stage).toBe('complete');
  });

  /**
   * The case the ledger exists for. The parent's data is gone, so the request succeeds — and
   * the vendor half is still owed, so the row says so rather than claiming completion.
   */
  it('still erases locally when the provider is down, and keeps the debt', async () => {
    const { service, deletedParents, ledger } = build({ directoryFails: true });

    const request = await service.deleteAccount({ parentId: PARENT.id });

    expect(deletedParents).toEqual([PARENT.id]);
    expect(request.stage).toBe('failed');

    const row = [...ledger.rows.values()][0];
    expect(row?.stage).toBe('failed');
    expect(row?.providerSubject).toBe(PARENT.supabaseUserId);
    expect(row?.attempts).toBe(1);
  });
});

describe('replay', () => {
  it('finishes what a provider outage left owing', async () => {
    const failing = build({ directoryFails: true });
    await failing.service.deleteAccount({ parentId: PARENT.id });

    // The same ledger, now with a provider that answers.
    const recovered = build();
    for (const row of failing.ledger.rows.values()) recovered.ledger.rows.set(row.id, row);

    await expect(recovered.service.replay()).resolves.toEqual({ finished: 1, failed: 0 });
    expect(recovered.deletedSubjects).toEqual([PARENT.supabaseUserId]);
  });

  it('does not erase locally a second time for a row that got that far', async () => {
    const failing = build({ directoryFails: true });
    await failing.service.deleteAccount({ parentId: PARENT.id });

    const recovered = build();
    for (const row of failing.ledger.rows.values()) recovered.ledger.rows.set(row.id, row);
    await recovered.service.replay();

    // `local_deleted` was already recorded, so the replay owes only the provider call.
    expect(recovered.deletedParents).toEqual([]);
  });

  it('is a no-op once everything is complete', async () => {
    const { service } = build();
    await service.deleteAccount({ parentId: PARENT.id });

    await expect(service.replay()).resolves.toEqual({ finished: 0, failed: 0 });
  });
});
