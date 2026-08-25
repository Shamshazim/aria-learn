import type { TutorInputEvent } from '@aria/shared';

import type { LoadedTurnContext, MovePlan, PolicyDecision, TutorPorts } from '../types';

export async function planMove<TModelContext>(input: {
  port: TutorPorts<TModelContext>['planMove'];
  context: LoadedTurnContext<TModelContext>;
  event: TutorInputEvent;
  decision: PolicyDecision;
}): Promise<MovePlan> {
  const proposed = await input.port({
    context: input.context,
    event: input.event,
    allowedMoves: input.decision.allowedMoves,
    fallback: input.decision.defaultPlan,
  });
  return input.decision.allowedMoves.includes(proposed.kind)
    ? proposed
    : input.decision.defaultPlan;
}
