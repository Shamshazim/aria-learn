export type AcknowledgementGate = Readonly<{
  wait(): Promise<boolean>;
  acknowledge(): void;
  close(): void;
  isClosed(): boolean;
}>;

export function createAcknowledgementGate(): AcknowledgementGate {
  let closed = false;
  let settle: ((acknowledged: boolean) => void) | null = null;
  const result = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const finish = (acknowledged: boolean): void => {
    settle?.(acknowledged);
    settle = null;
  };
  return {
    wait: () => result,
    acknowledge: () => {
      finish(true);
    },
    close: () => {
      closed = true;
      finish(false);
    },
    isClosed: () => closed,
  };
}
