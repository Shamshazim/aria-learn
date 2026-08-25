import type { EventPayload } from '@/features/session/model/input-events';

export const silenceScenario: readonly EventPayload[] = [
  { kind: 'SILENCE', waitedMs: 18_000, afterMoveId: 'ask-1' },
];
