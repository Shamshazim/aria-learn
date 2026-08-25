import { describe, expect, it, vi } from 'vitest';

import { createVoiceConsentService } from './consent.service';

describe('voice consent withdrawal', () => {
  it('closes media rooms and deletes retained audio for every child session', async () => {
    const close = vi.fn(() => Promise.resolve());
    const deleteForStudent = vi.fn(() => Promise.resolve(2));
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
        grant: vi.fn(),
        withdraw: () => Promise.resolve(true),
      },
      sessions: { closeForStudent: () => Promise.resolve(['session-1', 'session-2']) },
      deletion: { deleteForStudent, deleteExpired: vi.fn() },
      rooms: { close },
      ids: { next: () => 'consent-1' },
      clock: { now: () => new Date('2026-08-24T00:00:00.000Z') },
    });

    await expect(service.withdraw('parent-1', 'student-1')).resolves.toBe(true);
    expect(close).toHaveBeenCalledTimes(2);
    expect(deleteForStudent).toHaveBeenCalledWith(
      'student-1',
      new Date('2026-08-24T00:00:00.000Z'),
    );
  });
});
