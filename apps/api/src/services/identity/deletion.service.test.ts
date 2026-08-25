import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/errors';
import { createFakeIdentityProvider } from '@/identity/provider/fake.provider';
import { createLogger } from '@/lib/logger';
import type { AdultActor } from '@/types/identity';

import {
  createFakeDeletionLedger,
  createFakeErasureRepositories,
} from './__fixtures__/deletion.fake';
import {
  createFakeAdultIdentityRepository,
  createFakeAdultSessionRepository,
  resetFakeIds,
} from './__fixtures__/repositories.fake';
import { createDeletionService } from './deletion.service';

import type { DeletionCalls } from './__fixtures__/deletion.fake';
import type { DeletionService } from './deletion.service';

/**
 * "Delete means delete" spans two systems, so the property under test is not that a happy path
 * works — it is that a *failure* in the middle is durable and finishable.
 *
 * The sequence that matters: the ledger row is written before anything is destroyed, the local
 * rows go first, and a vendor call that fails leaves a row a later replay can finish. That is
 * the acceptance criterion "partial failures are durable and retryable", and everything below
 * is a way of asking it.
 */
const NOW = new Date('2026-08-24T12:00:00.000Z');

describe('deletionService', () => {
  let provider: ReturnType<typeof createFakeIdentityProvider>;
  let identities: ReturnType<typeof createFakeAdultIdentityRepository>;
  let ledger: ReturnType<typeof createFakeDeletionLedger>;
  let calls: DeletionCalls;
  let service: DeletionService;
  let actor: AdultActor;

  beforeEach(async () => {
    resetFakeIds();
    provider = createFakeIdentityProvider(() => NOW);
    identities = createFakeAdultIdentityRepository();
    ledger = createFakeDeletionLedger();
    calls = { erasedParents: [], erasedStudents: [] };

    const identity = await identities.insert({
      role: 'parent',
      provider: 'fake',
      providerSubject: 'subject-1',
      parentId: 'parent-1',
      attestedAdultAt: NOW,
    });

    actor = {
      adultId: identity.id,
      role: 'parent',
      parentId: 'parent-1',
      sessionId: 'session-1',
      providerSubject: 'subject-1',
      freshlyVerified: true,
    };

    service = createDeletionService({
      provider,
      identities,
      adultSessions: createFakeAdultSessionRepository(),
      ...createFakeErasureRepositories(calls),
      deletions: ledger,
      clock: { now: () => NOW },
      logger: createLogger({ level: 'silent' }),
    });
  });

  it('refuses without a fresh adult verification', async () => {
    await expect(service.deleteAdult({ ...actor, freshlyVerified: false })).rejects.toThrow(
      AppError,
    );
    expect(ledger.rows).toHaveLength(0);
  });

  it('erases Aria first, then the provider identity, and completes the ledger row', async () => {
    const request = await service.deleteAdult(actor);

    expect(calls.erasedParents).toEqual(['parent-1']);
    expect(provider.calls.at(-1)).toEqual({ method: 'deleteUser', subject: 'subject-1' });
    expect(request.stage).toBe('complete');
    expect(request.completedAt).toEqual(NOW);
  });

  it('leaves a durable, retryable row when the provider call fails', async () => {
    const failing = vi.spyOn(provider, 'deleteUser').mockRejectedValueOnce(new Error('vendor 503'));

    const request = await service.deleteAdult(actor);

    // The child data is already gone; only the vendor identity is outstanding.
    expect(calls.erasedParents).toEqual(['parent-1']);
    expect(request.stage).toBe('local_deleted');
    expect(request.completedAt).toBeNull();
    expect(request.attempts).toBe(1);
    expect(request.lastError).toContain('vendor 503');

    failing.mockRestore();
    const [replayed] = await service.replayPending();
    expect(replayed?.stage).toBe('complete');
  });

  it('is safe to replay repeatedly — a finished request is not revisited', async () => {
    await service.deleteAdult(actor);
    await expect(service.replayPending()).resolves.toHaveLength(0);
    await expect(service.replayPending()).resolves.toHaveLength(0);
  });

  it('redoes the local half of a request that died before it finished', async () => {
    // A row stuck at `requested` is a process that crashed between writing the intent and
    // destroying anything — or a restore from backup that brought the rows back.
    await ledger.open({
      subjectKind: 'adult',
      subjectId: actor.adultId,
      provider: 'fake',
      providerSubject: 'subject-1',
    });

    const [replayed] = await service.replayPending();

    expect(calls.erasedParents).toEqual(['parent-1']);
    expect(replayed?.stage).toBe('complete');
  });

  it('finishes a child deletion that never removed the child', async () => {
    await ledger.open({
      subjectKind: 'child',
      subjectId: 'student-9',
      provider: null,
      providerSubject: null,
    });

    const [replayed] = await service.replayPending();

    expect(calls.erasedStudents).toEqual(['student-9']);
    expect(replayed?.stage).toBe('complete');
    // A child has no identity-provider row, so nothing is asked of the vendor.
    expect(provider.calls.filter((call) => call.method === 'deleteUser')).toHaveLength(0);
  });
});
