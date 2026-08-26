import type { PlannedTurn } from '@aria/tutor';

import type { MustMention } from '@/quality';
import type { MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import type { ApiModelContext } from '@/services/content/turn-content.types';

/** Words too common to prove a reveal named anything in particular. */
const FILLER = new Set([
  'with',
  'that',
  'this',
  'them',
  'they',
  'then',
  'when',
  'from',
  'into',
  'their',
  'answer',
  'child',
  'same',
  'used',
  'uses',
]);
const MIN_IDEA_WORD = 4;

/**
 * What a reveal has to get said, and what the child has already tried (P2H-11).
 *
 * `master-plan.md` §4.1 asks a reveal to show the answer *with the reasoning*. Both halves are
 * checkable, so both are required rather than requested: a reveal that never says the number,
 * or says it and stops, goes back for regeneration instead of reaching a child.
 */
export function revealInputs(turn: PlannedTurn<ApiModelContext>, idea: string | null): MoveInputs {
  const answer = turn.context.modelContext.answerKey;
  return {
    lines: [
      ...(answer === null
        ? []
        : [`The answer is "${answer}". Say it, then say in one sentence why.`]),
      ...(idea === null
        ? []
        : [`This child's mistake was: ${idea}. Name that idea plainly, without calling it wrong.`]),
      'Finish by offering one more of the same kind, so the reveal is not the end of the road.',
    ],
    claims: {
      move: 'reveal',
      allowed: turn.decision.graded?.strategies ?? [],
      mustMention: [...answerMention(answer), ...ideaMention(idea)],
    },
  };
}

function answerMention(answer: string | null): readonly MustMention[] {
  if (answer === null) return [];
  return [
    {
      code: 'missing_answer',
      message: 'A reveal says the answer.',
      any: [answer],
    },
  ];
}

function ideaMention(idea: string | null): readonly MustMention[] {
  const words = idea === null ? [] : ideaWords(idea);
  if (words.length === 0) return [];
  return [
    {
      code: 'missing_idea',
      message: 'A reveal that follows a matched misconception names the idea behind it.',
      any: words,
    },
  ];
}

/** The words in a misconception's name that would show up if the reveal really named it. */
export function ideaWords(idea: string): readonly string[] {
  return [...idea.toLowerCase().matchAll(/[a-z]+/gu)]
    .map((match) => match[0])
    .filter((word) => word.length >= MIN_IDEA_WORD && !FILLER.has(word));
}
