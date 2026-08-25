import type { EventPayload } from '@/features/session/model/input-events';

export const interruptionScenario: readonly EventPayload[] = [
  { kind: 'SPEECH_STARTED' },
  { kind: 'INTERRUPT', interruptedMoveId: 'say-1' },
  { kind: 'SPEECH_FINAL', text: 'Wait, I have a question.' },
];
