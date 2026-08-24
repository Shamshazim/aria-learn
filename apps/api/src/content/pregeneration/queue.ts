export type BackgroundTask = () => Promise<void>;

export type BoundedQueue = Readonly<{
  enqueue(task: BackgroundTask): boolean;
  pending(): number;
}>;

/** A serial, bounded in-process queue; rejected work never blocks the active turn. */
export function createBoundedQueue(options: {
  capacity: number;
  onError: (error: unknown) => void;
}): BoundedQueue {
  const tasks: BackgroundTask[] = [];
  let running = false;

  const runNext = async (): Promise<void> => {
    const task = tasks.shift();
    if (task === undefined) {
      running = false;
      return;
    }
    try {
      await task();
    } catch (error) {
      options.onError(error);
    }
    await runNext();
  };

  return {
    enqueue(task) {
      if (tasks.length + (running ? 1 : 0) >= options.capacity) return false;
      tasks.push(task);
      if (!running) {
        running = true;
        void runNext();
      }
      return true;
    },
    pending: () => tasks.length + (running ? 1 : 0),
  };
}
