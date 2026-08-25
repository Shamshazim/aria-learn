export { arrivalScenario } from '@/features/session/sources/scenarios/arrival';
export { confusionScenario } from '@/features/session/sources/scenarios/confusion';
export { endingScenario } from '@/features/session/sources/scenarios/ending';
export { fatigueScenario } from '@/features/session/sources/scenarios/fatigue';
export { firstVisitScenario } from '@/features/session/sources/scenarios/first-visit';
export { interruptionScenario } from '@/features/session/sources/scenarios/interruption';
export { returningChildScenario } from '@/features/session/sources/scenarios/returning-child';
export { silenceScenario } from '@/features/session/sources/scenarios/silence';

import type { EventPayload } from '@/features/session/model/input-events';
import { arrivalScenario } from '@/features/session/sources/scenarios/arrival';
import { confusionScenario } from '@/features/session/sources/scenarios/confusion';
import { endingScenario } from '@/features/session/sources/scenarios/ending';
import { fatigueScenario } from '@/features/session/sources/scenarios/fatigue';
import { firstVisitScenario } from '@/features/session/sources/scenarios/first-visit';
import { interruptionScenario } from '@/features/session/sources/scenarios/interruption';
import { returningChildScenario } from '@/features/session/sources/scenarios/returning-child';
import { silenceScenario } from '@/features/session/sources/scenarios/silence';

const SCENARIOS = new Map<string, readonly EventPayload[]>([
  ['arrival', arrivalScenario],
  ['confusion', confusionScenario],
  ['ending', endingScenario],
  ['fatigue', fatigueScenario],
  ['first-visit', firstVisitScenario],
  ['interruption', interruptionScenario],
  ['returning-child', returningChildScenario],
  ['silence', silenceScenario],
]);

export const SCENARIO_NAMES = [...SCENARIOS.keys()];

export function scenarioEvents(name: string | null): readonly EventPayload[] | undefined {
  return name === null ? undefined : SCENARIOS.get(name);
}
