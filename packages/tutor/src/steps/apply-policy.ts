import type { TutorInputEvent } from '@aria/shared';

import type { LoadedTurnContext, PolicyDecision, TutorPorts } from '../types';

export function applyPolicy<TModelContext>(
  port: TutorPorts<TModelContext>['applyPolicy'],
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): Promise<PolicyDecision> {
  return port(context, event);
}
