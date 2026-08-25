export type AheadService<TRequest> = Readonly<{
  schedule(sessionId: string, request: TRequest): void;
  cancel(sessionId: string): void;
}>;

export function createAheadService<TRequest>(deps: {
  prepare(request: TRequest, signal: AbortSignal): Promise<void>;
  onError(error: unknown, sessionId: string): void;
}): AheadService<TRequest> {
  const pending = new Map<string, AbortController>();
  return {
    schedule(sessionId, request) {
      pending.get(sessionId)?.abort();
      const controller = new AbortController();
      pending.set(sessionId, controller);
      void deps
        .prepare(request, controller.signal)
        .catch((error: unknown) => {
          if (!controller.signal.aborted) deps.onError(error, sessionId);
        })
        .finally(() => {
          if (pending.get(sessionId) === controller) pending.delete(sessionId);
        });
    },
    cancel(sessionId) {
      pending.get(sessionId)?.abort();
      pending.delete(sessionId);
    },
  };
}
