import type { TutorInputEvent } from '@aria/shared';

import type { LoadedTurnContext, TutorPorts } from '../types';

export function loadContext<TModelContext>(
  port: TutorPorts<TModelContext>['loadContext'],
  event: TutorInputEvent,
): Promise<LoadedTurnContext<TModelContext>> {
  return port(event);
}
