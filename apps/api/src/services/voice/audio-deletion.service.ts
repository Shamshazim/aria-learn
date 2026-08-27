import type {
  RetainedAudioReference,
  RetainedAudioRepository,
} from '@/repositories/retained-audio.repository';

export type AudioDeletionPort = Readonly<{
  deleteObject(storageKey: string): Promise<void>;
  deleteProcessorCopy(processor: string, reference: string): Promise<void>;
}>;

export type AudioDeletionService = Readonly<{
  deleteExpired(at: Date): Promise<number>;
  deleteForStudent(studentId: string, at: Date): Promise<number>;
}>;

export function createAudioDeletionService(deps: {
  audio: RetainedAudioRepository;
  deletion: AudioDeletionPort;
}): AudioDeletionService {
  const remove = async (records: readonly RetainedAudioReference[], at: Date): Promise<number> => {
    for (const record of records) {
      await deps.deletion.deleteObject(record.storageKey);
      for (const [processor, reference] of Object.entries(record.processorRefs)) {
        await deps.deletion.deleteProcessorCopy(processor, reference);
      }
    }
    await deps.audio.markDeleted(
      records.map((record) => record.id),
      at,
    );
    return records.length;
  };
  return {
    deleteExpired: async (at) => remove(await deps.audio.listExpired(at), at),
    deleteForStudent: async (studentId, at) =>
      remove(await deps.audio.listForStudent(studentId), at),
  };
}
