import type { EventPayload } from '@/features/session/model/input-events';

export const fatigueScenario: readonly EventPayload[] = [
  { kind: 'BACKCHANNEL' },
  { kind: 'PAUSE' },
  { kind: 'RESUME' },
];
