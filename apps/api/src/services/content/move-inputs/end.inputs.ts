import type { PlannedTurn } from '@aria/tutor';

import type { MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import type { ApiModelContext } from '@/services/content/turn-content.types';
import type { RecapMoment, SessionRecap } from '@/services/session/recap.types';

const MOMENT_LINE: Readonly<Record<RecapMoment['kind'], string>> = {
  'after-reteach': 'came back to {skill} after you explained it a second way, and got it',
  persistence: 'stayed with {skill} through several wrong tries and got there',
  'first-correct': 'worked out {skill} without being told',
};

/**
 * The session, as the child would remember it (P2H-11).
 *
 * The counts are given to the model and forbidden in the output on purpose. "You got most of
 * them" has to be *true*, which needs the count; "you got eight out of ten" turns an hour of
 * work into a mark, which `master-plan.md` §14 rules out. The claims check enforces the second
 * half, so the prompt can be told the truth without the child hearing a score.
 */
export function endInputs(
  turn: PlannedTurn<ApiModelContext>,
  recap: SessionRecap | null,
): MoveInputs {
  const claims = { move: 'end', allowed: [] } as const;
  if (recap === null || recap.attempted === 0) {
    return {
      lines: [
        'This session ended before the child answered anything. Say goodbye warmly without pretending work was done.',
      ],
      claims,
    };
  }
  return {
    lines: [
      `What you worked on: ${recap.skills.map((skill) => skill.name).join(', ')}.`,
      `How it went: ${String(recap.correct)} right out of ${String(recap.attempted)} — for your judgement only. Never say a number or a score to the child.`,
      ...momentLine(recap),
      ...(turn.decision.reasons.includes('stop_request') || turn.event.kind === 'LEAVE'
        ? [
            'The child asked to stop. That is fine — name the one real thing they did and let them go.',
          ]
        : []),
      'Two or three sentences, past tense, then goodbye.',
    ],
    claims,
  };
}

function momentLine(recap: SessionRecap): readonly string[] {
  const moment = recap.moment;
  if (moment === null) return [];
  const template = MOMENT_LINE[moment.kind].replace('{skill}', moment.skillName);
  return [`The moment worth naming: they ${template}.`];
}
