import type { EventPayload } from '@/features/session/model/input-events';

export const firstVisitScenario: readonly EventPayload[] = [
  { kind: 'ARRIVED', grade: '1' },
  { kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '1', fromRecommendation: false },
];
