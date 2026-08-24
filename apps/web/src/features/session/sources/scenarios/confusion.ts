import type { EventPayload } from '@/features/session/model/input-events';

export const confusionScenario: readonly EventPayload[] = [
  { kind: 'ANSWER', respondsTo: 'ask-1', text: '6' },
  { kind: 'ANSWER', respondsTo: 'ask-2', text: '6' },
  { kind: 'CONFUSED', aboutMoveId: 'ask-2' },
];
