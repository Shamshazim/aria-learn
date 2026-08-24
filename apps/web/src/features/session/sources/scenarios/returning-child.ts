import type { EventPayload } from '@/features/session/model/input-events';

export const returningChildScenario: readonly EventPayload[] = [
  { kind: 'RESUME' },
  { kind: 'QUESTION', text: 'Can we use the same trick as last time?' },
];
