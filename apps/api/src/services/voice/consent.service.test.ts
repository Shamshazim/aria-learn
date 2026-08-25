import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createVoiceConsentService } from './consent.service';

const transactionDb = new Pool();

describe('voice consent withdrawal', () => {
  it('closes media rooms and deletes retained audio for every child session', async () => {
    const close = vi.fn(() => Promise.resolve());
    const deleteForStudent = vi.fn(() => Promise.resolve(2));
    const grant = vi.fn();
    const withdraw = () => Promise.resolve(true);
    const closeForStudent = () =>
      Promise.resolve([
        { sessionId: 'session-1', connectionEpoch: 2 },
        { sessionId: 'session-2', connectionEpoch: 4 },
      ]);
    const service = createVoiceConsentService({
      students: {
        findById: () =>
          Promise.resolve({
            id: 'student-1',
            parentId: 'parent-1',
            displayName: 'Sam',
            grade: '1',
            band: 'early',
            createdAt: new Date('2026-08-24T00:00:00.000Z'),
          }),
      },
      consent: {
        grant,
        withdraw,
        withDb: () => ({ grant, withdraw }),
      },
      sessions: {
        closeForStudent,
        withDb: () => ({ closeForStudent }),
      },
      lifecycle: { exclusive: (_studentId, operation) => operation(transactionDb) },
      deletion: { deleteForStudent, deleteExpired: vi.fn() },
      rooms: { close },
      ids: { next: () => 'consent-1' },
      clock: { now: () => new Date('2026-08-24T00:00:00.000Z') },
    });

    await expect(service.withdraw('parent-1', 'student-1')).resolves.toBe(true);
    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenNthCalledWith(1, 'aria_session-1_2');
    expect(close).toHaveBeenNthCalledWith(2, 'aria_session-2_4');
    expect(deleteForStudent).toHaveBeenCalledWith(
      'student-1',
      new Date('2026-08-24T00:00:00.000Z'),
    );
  });

  it('commits withdrawal before reporting a room-provider failure', async () => {
    let committed = false;
    let rejectRoom: ((error: Error) => void) | undefined;
    const grant = vi.fn();
    const withdraw = vi.fn(() => Promise.resolve(true));
    const closeForStudent = () => Promise.resolve([{ sessionId: 'session-1', connectionEpoch: 2 }]);
    const service = createVoiceConsentService({
      students: {
        findById: () =>
          Promise.resolve({
            id: 'student-1',
            parentId: 'parent-1',
            displayName: 'Sam',
            grade: '1',
            band: 'early',
            createdAt: new Date(),
          }),
      },
      consent: { grant, withdraw, withDb: () => ({ grant, withdraw }) },
      sessions: { closeForStudent, withDb: () => ({ closeForStudent }) },
      lifecycle: {
        exclusive: async (_studentId, operation) => {
          const result = await operation(transactionDb);
          committed = true;
          return result;
        },
      },
      deletion: { deleteForStudent: vi.fn(() => Promise.resolve(0)), deleteExpired: vi.fn() },
      rooms: {
        close: () =>
          new Promise<void>((_resolve, reject) => {
            rejectRoom = reject;
          }),
      },
      ids: { next: () => 'consent-1' },
      clock: { now: () => new Date() },
    });

    const withdrawal = service.withdraw('parent-1', 'student-1');
    await vi.waitFor(() => {
      expect(rejectRoom).toBeDefined();
    });
    expect(committed).toBe(true);
    rejectRoom?.(new Error('room provider unavailable'));
    await expect(withdrawal).rejects.toThrow(/room provider unavailable/);
  });
});
