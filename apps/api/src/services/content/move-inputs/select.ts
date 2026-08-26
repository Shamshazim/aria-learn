import type { MoveKind } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { endInputs } from '@/services/content/move-inputs/end.inputs';
import { NO_MOVE_INPUTS, type MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import { praiseInputs } from '@/services/content/move-inputs/praise.inputs';
import { revealInputs } from '@/services/content/move-inputs/reveal.inputs';
import { switchInputs } from '@/services/content/move-inputs/switch.inputs';
import type { ApiModelContext } from '@/services/content/turn-content.types';
import type { SessionRecap } from '@/services/session/recap.types';

/** What the builders are given beyond the turn: the things only the caller can look up. */
export type MoveInputExtras = Readonly<{
  misconceptionIdea: string | null;
  recap: SessionRecap | null;
}>;

type Builder = (turn: PlannedTurn<ApiModelContext>, extras: MoveInputExtras) => MoveInputs;

/**
 * Which moves get evidence, and which builder gives it to them (P2H-11).
 *
 * Five moves are here because five moves make claims about the child or the session. The rest
 * — a hint, a re-ask — are about the item in front of them, which the prompt already carries.
 * A map rather than a chain of `if`s, matching `MOVE_INSTRUCTIONS` and `MOVE_FALLBACKS`: the
 * question "what does this move get?" should be answerable by reading one table.
 */
const BUILDERS: Partial<Readonly<Record<MoveKind, Builder>>> = {
  PRAISE: (turn) => praiseInputs(turn),
  REVEAL: (turn, extras) => revealInputs(turn, extras.misconceptionIdea),
  SWITCH: (turn) => switchInputs(turn),
  END: (turn, extras) => endInputs(turn, extras.recap),
  BREAK: (turn, extras) => endInputs(turn, extras.recap),
};

export function moveInputsFor(
  turn: PlannedTurn<ApiModelContext>,
  extras: MoveInputExtras,
): MoveInputs {
  return BUILDERS[turn.plan.kind]?.(turn, extras) ?? NO_MOVE_INPUTS;
}

/** The inputs as the prompt sees them: one fact per line, under a heading it can ignore. */
export function renderMoveInputs(inputs: MoveInputs): string | undefined {
  if (inputs.lines.length === 0) return undefined;
  return [
    'What you know about this child right now:',
    ...inputs.lines.map((line) => `- ${line}`),
  ].join('\n');
}
