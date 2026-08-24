import { useState } from 'react';

import type { MockSession } from '@/features/session/model/mock-session';

export type MockSessionView = Readonly<{
  stepIndex: number;
  selected: string | null;
  hint: string | null;
  complete: boolean;
  choose(value: string): void;
  next(): void;
}>;

export function useMockSession(session: MockSession): MockSessionView {
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const step = session.steps[stepIndex];

  return {
    stepIndex,
    selected,
    hint,
    complete,
    choose: (value) => {
      setSelected(value);
      setHint(value === step?.answer ? null : (step?.hint ?? null));
    },
    next: () => {
      if (selected !== step?.answer) return;
      if (stepIndex === session.steps.length - 1) setComplete(true);
      else setStepIndex((current) => current + 1);
      setSelected(null);
      setHint(null);
    },
  };
}
