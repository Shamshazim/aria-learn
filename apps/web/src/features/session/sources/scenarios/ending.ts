import type { EventPayload } from '@/features/session/model/input-events';

export const endingScenario: readonly EventPayload[] = [
  { kind: 'MEDIA_LOST' },
  { kind: 'MEDIA_RESTORED' },
  { kind: 'LEAVE', reason: 'done' },
];
