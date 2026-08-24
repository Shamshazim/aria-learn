import type { DisclosureWriter, ScrubbedContext } from '@/privacy/types';

export type DisclosureService = {
  recordSharedContext(input: { context: ScrubbedContext; generationLogId: string }): Promise<void>;
};

export type DisclosureServiceDeps = {
  writer: DisclosureWriter;
};

/** Persists category names only; learner values never cross this interface. */
export function createDisclosureService({ writer }: DisclosureServiceDeps): DisclosureService {
  return {
    recordSharedContext: ({ context, generationLogId }) =>
      writer.save({ generationLogId, categories: context.categories }),
  };
}
