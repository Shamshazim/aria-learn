/** One abort signal that fires on caller cancellation or the endpoint deadline, whichever is first. */
export type RequestTimeout = {
  signal: AbortSignal;
  didExpire: () => boolean;
  dispose: () => void;
};

/** Combines caller cancellation with a bounded provider-call timeout. */
export function createRequestTimeout(timeoutMs: number, source?: AbortSignal): RequestTimeout {
  const controller = new AbortController();
  let expired = false;
  const abortFromSource = (): void => {
    controller.abort(source?.reason);
  };
  source?.addEventListener('abort', abortFromSource, { once: true });
  if (source?.aborted === true) abortFromSource();
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didExpire: () => expired,
    dispose: () => {
      clearTimeout(timer);
      source?.removeEventListener('abort', abortFromSource);
    },
  };
}
