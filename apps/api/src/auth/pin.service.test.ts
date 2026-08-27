import { describe, expect, it } from 'vitest';

import type { ChildCredential } from '@/types/auth';

import { fakeChildCredentials, plainHasher } from './__fixtures__/identity.fixture';
import { createChildCredentialService, LOCK_MS, MAX_ATTEMPTS } from './pin.service';

const START = new Date('2026-08-25T09:00:00.000Z');

function build(seed: Partial<ChildCredential> = {}) {
  let now = START;
  const credentials = fakeChildCredentials(seed);
  const service = createChildCredentialService({
    credentials,
    hasher: plainHasher,
    clock: { now: () => now },
  });
  return {
    service,
    credentials,
    advance: (ms: number): void => {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe('how a child signs in', () => {
  it('reports what a grown-up has set up, and says so plainly when nothing is', async () => {
    const { service } = build();
    await expect(service.methodFor('student-1')).resolves.toBe('none');

    await service.setPin('student-1', '1234');
    await expect(service.methodFor('student-1')).resolves.toBe('pin');

    await service.setFamilyDevice('student-1', true);
    // The family device wins: it is the most recent thing the parent said about this tablet.
    await expect(service.methodFor('student-1')).resolves.toBe('family-device');
  });

  it('lets the right PIN in and keeps the wrong one out', async () => {
    const { service } = build();
    await service.setPin('student-1', '4207');

    await expect(service.attempt('student-1', { pin: '4207' })).resolves.toEqual({ ok: true });
    await expect(service.attempt('student-1', { pin: '4208' })).resolves.toEqual({
      ok: false,
      reason: 'wrong',
    });
  });

  it('accepts a picture sequence in order and refuses the same pictures shuffled', async () => {
    const { service } = build();
    await service.setPictureSequence('student-1', ['fox', 'star', 'owl']);

    await expect(
      service.attempt('student-1', { pictureSequence: ['fox', 'star', 'owl'] }),
    ).resolves.toEqual({ ok: true });
    await expect(
      service.attempt('student-1', { pictureSequence: ['star', 'fox', 'owl'] }),
    ).resolves.toEqual({ ok: false, reason: 'wrong' });
  });

  it('waves a family device through without asking for anything', async () => {
    const { service } = build();
    await service.setFamilyDevice('student-1', true);

    await expect(service.attempt('student-1', {})).resolves.toEqual({ ok: true });
  });

  /** P2H-12: five wrong tries and the door closes for fifteen minutes. */
  it('locks after five wrong PINs and opens again once the lock has run out', async () => {
    const { service, advance } = build();
    await service.setPin('student-1', '1111');

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      await expect(service.attempt('student-1', { pin: '0000' })).resolves.toEqual({
        ok: false,
        reason: 'wrong',
      });
    }
    await expect(service.attempt('student-1', { pin: '0000' })).resolves.toEqual({
      ok: false,
      reason: 'locked',
    });
    // Even the right PIN, while it is locked.
    await expect(service.attempt('student-1', { pin: '1111' })).resolves.toEqual({
      ok: false,
      reason: 'locked',
    });

    advance(LOCK_MS + 1_000);
    await expect(service.attempt('student-1', { pin: '1111' })).resolves.toEqual({ ok: true });
  });

  it('forgets the failed attempts once a child gets it right', async () => {
    const { service, credentials } = build();
    await service.setPin('student-1', '1111');

    await service.attempt('student-1', { pin: '0000' });
    await service.attempt('student-1', { pin: '1111' });

    await expect(credentials.find('student-1')).resolves.toMatchObject({ failedAttempts: 0 });
  });

  /** Offering the wrong kind of credential is not the child's mistake, so it is not counted. */
  it('does not count an attempt against a method this child does not have', async () => {
    const { service, credentials } = build();
    await service.setPin('student-1', '1111');

    await expect(
      service.attempt('student-1', { pictureSequence: ['fox', 'owl', 'star'] }),
    ).resolves.toEqual({ ok: false, reason: 'not-configured' });
    await expect(credentials.find('student-1')).resolves.toMatchObject({ failedAttempts: 0 });
  });

  it('clears a lock when a parent changes how the child signs in', async () => {
    const { service, credentials } = build();
    await service.setPin('student-1', '1111');
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await service.attempt('student-1', { pin: '0000' });
    }

    await service.setPin('student-1', '2222');

    await expect(credentials.find('student-1')).resolves.toMatchObject({
      failedAttempts: 0,
      lockedUntil: null,
    });
    await expect(service.attempt('student-1', { pin: '2222' })).resolves.toEqual({ ok: true });
  });
});
