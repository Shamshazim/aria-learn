import type { PlannedTurn } from '@aria/tutor';

import { endInputs } from '@/services/content/move-inputs/end.inputs';
import { NO_MOVE_INPUTS, type MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import { praiseInputs } from '@/services/content/move-inputs/praise.inputs';
import { revealInputs } from '@/services/content/move-inputs/reveal.inputs';
import { switchInputs } from '@/services/content/move-inputs/switch.inputs';
import type { ApiModelContext } from '@/services/content/turn-content.types';
import type { SessionRecap } from '@/services/session/recap.types';

/**
 * The evidence a move gets to be specific with, or nothing (P2H-11).
 *
 * Five moves have inputs because five moves make claims about the child or the session. The
 * rest — a hint, a re-ask — are about the item in front of them, which the prompt already has.
 */
export function moveInputsFor(
  turn: PlannedTurn<ApiModelContext>,
  extras: Readonly<{ misconceptionIdea: string | null; recap: SessionRecap | null }>,
): MoveInputs {
  if (turn.plan.kind === 'PRAISE') return praiseInputs(turn);
  if (turn.plan.kind === 'REVEAL') return revealInputs(turn, extras.misconceptionIdea);
  if (turn.plan.kind === 'SWITCH') return switchInputs(turn);
  if (turn.plan.kind === 'END' || turn.plan.kind === 'BREAK') return endInputs(turn, extras.recap);
  return NO_MOVE_INPUTS;
}

/** The inputs as the prompt sees them: one fact per line, under a heading it can ignore. */
export function renderMoveInputs(inputs: MoveInputs): string | undefined {
  if (inputs.lines.length === 0) return undefined;
  return [
    'What you know about this child right now:',
    ...inputs.lines.map((line) => `- ${line}`),
  ].join('\n');
}
