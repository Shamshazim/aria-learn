import { outcome, plan, type PolicyOutcome } from './outcome';

import type { SelfCorrection } from '../intent/self-correction';
import type { LoadedTurnContext } from '../types';

/**
 * P3-06: the child told Aria something she remembered has changed. One sentence of
 * acknowledgement — "Got it, no more trucks." — and the lesson carries on. Not graded, not a
 * lecture, and not weighed by a planner: the words are fixed and the API applies the change.
 */
export function selfCorrectionOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  correction: SelfCorrection,
): PolicyOutcome {
  return outcome(
    {
      ...plan('SAY', 'acknowledge-correction', 'The child corrected something Aria knew.', context),
      evidence: correctionEvidence(correction),
    },
    ['self_correction'],
  );
}

function correctionEvidence(correction: SelfCorrection): Readonly<Record<string, string>> {
  switch (correction.kind) {
    case 'stopped_liking':
      return { selfCorrection: correction.kind, selfCorrectionThing: correction.thing };
    case 'renamed':
      return {
        selfCorrection: correction.kind,
        selfCorrectionRelation: correction.relation,
        selfCorrectionName: correction.name,
      };
    default:
      return { selfCorrection: correction.kind, selfCorrectionGrade: correction.grade };
  }
}
