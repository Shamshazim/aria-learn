import type { BoundedQueue } from '@/content/pregeneration/queue';

export type PregenerateService<TRequest> = Readonly<{
  prepareNext(request: TRequest): boolean;
}>;

/** Schedules n+1 without awaiting it; capacity and failures belong to the queue. */
export function createPregenerateService<TRequest>(dependencies: {
  queue: BoundedQueue;
  prepare: (request: TRequest) => Promise<void>;
}): PregenerateService<TRequest> {
  return {
    prepareNext: (request) => dependencies.queue.enqueue(() => dependencies.prepare(request)),
  };
}
