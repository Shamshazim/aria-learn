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
      ...workingLine(turn),
      ...saidLine(turn),
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

/**
 * The numbers the answer comes out of, so the reasoning is about this item and not about the
 * idea in general.
 *
 * The spec asks for "the skill's checker trace"; P0-16 returns a verdict, an expected answer
 * and a one-line reason ("Exact integer addition matches"), not steps a child could follow.
 * The structured problem is what it does expose, and it is the part that makes the sentence
 * concrete — extending the checker to emit steps belongs to P0-16, not here.
 */
function workingLine(turn: PlannedTurn<ApiModelContext>): readonly string[] {
  const problem = turn.context.modelContext.arithmeticProblem;
  if (problem === null) return [];
  if (problem.kind === 'sequence') {
    return [`The working: the run is ${problem.values.join(', ')}, going up in ${problem.step}s.`];
  }
  return [`The working: it comes from ${problem.left} and ${problem.right}.`];
}

/** What the child put, so the reveal answers their answer rather than a generic wrong one. */
function saidLine(turn: PlannedTurn<ApiModelContext>): readonly string[] {
  const event = turn.event;
  const said = event.kind === 'ANSWER' ? (event.text ?? event.choiceId) : undefined;
  return said === undefined || said === '' ? [] : [`What this child put: "${said}".`];
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
function ideaWords(idea: string): readonly string[] {
  return [...idea.toLowerCase().matchAll(/[a-z]+/gu)]
    .map((match) => match[0])
    .filter((word) => word.length >= MIN_IDEA_WORD && !FILLER.has(word));
}
