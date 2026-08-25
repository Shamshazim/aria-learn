import { describe, expect, it, vi } from 'vitest';

import { createAudioDeletionService } from './audio-deletion.service';

describe('child audio deletion', () => {
  it('deletes Aria storage and every recorded processor copy before marking the row deleted', async () => {
    const deleteObject = vi.fn(() => Promise.resolve());
    const deleteProcessorCopy = vi.fn(() => Promise.resolve());
    const markDeleted = vi.fn(() => Promise.resolve());
    const service = createAudioDeletionService({
      audio: {
        listExpired: () => Promise.resolve([]),
        listForStudent: () =>
          Promise.resolve([
            { id: 'clip-1', storageKey: 'audio/clip-1', processorRefs: { stt: 'vendor-1' } },
          ]),
        markDeleted,
      },
      deletion: { deleteObject, deleteProcessorCopy },
    });

    expect(await service.deleteForStudent('student-1', new Date('2026-08-24T00:00:00Z'))).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith('audio/clip-1');
    expect(deleteProcessorCopy).toHaveBeenCalledWith('stt', 'vendor-1');
    expect(markDeleted).toHaveBeenCalledWith(['clip-1'], expect.any(Date));
  });
});
