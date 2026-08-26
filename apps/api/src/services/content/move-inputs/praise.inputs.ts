import type { PlannedTurn } from '@aria/tutor';

import { STRATEGY_CLAIMS } from '@/quality/checks/claims/claim-vocabulary.data';
import type { MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import type { ApiModelContext } from '@/services/content/turn-content.types';

/** An answer inside this is fast enough to call fast, and slow enough not to be a mis-tap. */
const QUICK_MS = 6_000;
/** Beyond this many words, the child said more than the answer and explained something. */
const EXPLAINED_WORDS = 4;
/** After this many praises in a row, the next one is worth less than a quieter "next one". */
const STREAK_BEFORE_VARYING = 3;

/** The Aria moves that answer an attempt, so a run of them is a run of feedback. */
const FEEDBACK_KINDS: ReadonlySet<string> = new Set([
  'PRAISE',
  'REVEAL',
  'HINT',
  'RETEACH',
  'SWITCH',
]);

/**
 * What this child just did that is worth naming (P2H-11).
 *
 * Every line is something the turn can prove. The grader's own list is where the *method*
 * claims come from — it is the only part of the turn that knows what the item required — and
 * the behaviour claims come from the shape of the attempt: how long it took, how many tries,
 * whether they said more than the answer.
 */
export function praiseInputs(turn: PlannedTurn<ApiModelContext>): MoveInputs {
  const allowed = [...(turn.decision.graded?.strategies ?? []), ...behaviours(turn)];
  return {
    lines: [
      ...(turn.context.modelContext.answerKey === null
        ? ['The child answered in their own words.']
        : [`The child answered "${turn.context.modelContext.answerKey}", which is right.`]),
      ...struggleLine(turn),
      ...streakLine(turn),
      ...(afterReveal(turn)
        ? [
            'You have just told them this answer. Do not praise the answer itself — praise that they stayed with it.',
          ]
        : []),
      claimsLine(allowed),
    ],
    claims: { move: 'praise', allowed },
  };
}

/** Claims the shape of this attempt earns, whatever the skill was. */
function behaviours(turn: PlannedTurn<ApiModelContext>): readonly string[] {
  const earned: string[] = [];
  if (turn.context.session.consecutiveWrong > 0 || turn.plan.attempt > 1) earned.push('kept-going');
  if (turn.context.session.lastApproach !== null && turn.context.session.consecutiveWrong > 0) {
    earned.push('tried-another-way');
  }
  if (answeredWithin(turn, QUICK_MS) && turn.context.session.consecutiveWrong === 0) {
    earned.push('answered-quickly');
  }
  if (wordsSaid(turn) > EXPLAINED_WORDS) earned.push('explained-your-thinking');
  if (turn.context.recentKinds.includes('SHOW')) earned.push('used-the-picture');
  return earned;
}

function answeredWithin(turn: PlannedTurn<ApiModelContext>, ms: number): boolean {
  const elapsed = turn.event.kind === 'ANSWER' ? turn.event.elapsedMs : undefined;
  return elapsed !== undefined && elapsed <= ms;
}

function wordsSaid(turn: PlannedTurn<ApiModelContext>): number {
  const event = turn.event;
  const said =
    event.kind === 'ANSWER' ? (event.text ?? '') : event.kind === 'SPEECH_FINAL' ? event.text : '';
  return said.trim() === '' ? 0 : said.trim().split(/\s+/u).length;
}

function struggleLine(turn: PlannedTurn<ApiModelContext>): readonly string[] {
  const misconception = turn.context.session.repeatedMisconception;
  if (misconception === null) return [];
  return [
    'Earlier today this child kept making the same mistake on this skill, and has not made it this time.',
  ];
}

/** P2H-11: the fourth cheer in a row is noise, so the model is told to drop the volume. */
function streakLine(turn: PlannedTurn<ApiModelContext>): readonly string[] {
  return praiseStreak(turn.context.recentKinds) >= STREAK_BEFORE_VARYING
    ? [
        'You have praised this child several times in a row. Say less this time — a short "okay, next one" is warmer than another cheer.',
      ]
    : [];
}

export function praiseStreak(recentKinds: readonly string[]): number {
  const feedback = recentKinds.filter((kind) => FEEDBACK_KINDS.has(kind));
  let streak = 0;
  for (const kind of [...feedback].reverse()) {
    if (kind !== 'PRAISE') break;
    streak += 1;
  }
  return streak;
}

/** P2H-11: praise for an answer the child was just handed is praise for listening. */
function afterReveal(turn: PlannedTurn<ApiModelContext>): boolean {
  const feedback = turn.context.recentKinds.filter((kind) => FEEDBACK_KINDS.has(kind));
  return feedback.at(-1) === 'REVEAL';
}

function claimsLine(allowed: readonly string[]): string {
  const says = STRATEGY_CLAIMS.filter((claim) => allowed.includes(claim.id)).map(
    (claim) => claim.says,
  );
  if (says.length === 0) {
    return 'You know they got it right and nothing about how. Name what was right, not a method you did not see.';
  }
  return `The only things you may say this child did: ${says.join('; ')}.`;
}
