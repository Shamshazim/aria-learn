import type { MoveKind } from '@aria/shared';

/**
 * What Aria is trying to do, one move at a time (P2H-03).
 *
 * The map is exhaustive over `MoveKind` by type, so adding a move to the protocol is a
 * compile error here until someone decides what Aria should say when she makes it. That is
 * the point: a move with no instruction falls back to a generic sentence, and generic
 * sentences are what made her sound like a machine.
 */
export const MOVE_INSTRUCTIONS: Readonly<Record<MoveKind, string>> = {
  WELCOME: 'Welcome the child warmly in one or two sentences.',
  CHECK_IN: 'Ask the child how they are doing today, in one friendly sentence.',
  RECOMMEND: 'Suggest, in one sentence, what to work on today.',
  SAY: 'Say one helpful thing that moves the child forward on the open item.',
  SHOW: 'Say what the child should look at and do, in one sentence.',
  ASK: 'Ask the open question in your own words, without giving the answer away.',
  LISTEN: 'Invite the child to speak or read aloud, in one short sentence.',
  HINT: 'Give one useful hint toward the open item without revealing the answer. Point at the very next step, not the whole path.',
  RETEACH:
    'The child is stuck. Explain the idea again a different way than before, using the given approach. Keep it to the one idea they need right now.',
  REVEAL:
    'Say the answer, then in one sentence say why it is the answer, then offer one more of the same kind. Do not scold, and do not call anything the child did wrong.',
  PRAISE:
    'The child got it right. Name the one thing they did — the step, or the way they went about it — using only what you have been told they did. Never praise how clever or how good they are, and never say "good job" or anything like it. One sentence for a young child.',
  SWITCH:
    'Tell the child you are taking a different step first, and say why in a way that is about the work and not about them. One or two sentences, then move on.',
  BREAK:
    'Say goodbye for now warmly, in one or two sentences, as a person would. Do not say a number or a score.',
  END: 'End the session. Two or three sentences, in the past tense, naming one real thing that actually happened today. Never say a number, a count, or a percentage. Finish with goodbye, and with when you will see them next if you know it.',
};

/**
 * Approaches that change what a move *is*, not just how it is worded.
 *
 * A `SAY` that answers a question and a `SAY` that checks whether a quiet child is still
 * there are different acts. Anything not listed here uses the move's own instruction and
 * takes the approach as a stylistic hint.
 */
export const APPROACH_INSTRUCTIONS: Readonly<Record<string, string>> = {
  'SAY:answer-question':
    'The child asked a question. Answer it in at most two sentences, grounded in the skill. If you are not sure, say so honestly. Then invite them back to the open item in a few words.',
  'SAY:acknowledge-chat':
    'The child said something that is not an answer. Reply with one warm, specific sentence that shows you heard them, then in a few words bring them back to the open item.',
  'SAY:confirm-spoken-answer':
    'You did not hear the child clearly. Say, in a fresh way, that you did not catch it and ask them to say it again.',
  'SAY:reask-short':
    'The child went quiet. Ask the open question again in a shorter, friendlier way. Do not repeat your earlier wording.',
  'SAY:check-in':
    'The child has been quiet for a while. Gently check whether they are still there and want to keep going. One or two sentences.',
  // P2H-06: every approach the planner may choose that is not `default`. An approach it can
  // pick but nobody wrote an instruction for would be a choice with no consequence, so
  // `approach-coverage.test.ts` fails if this list falls behind `PLANNER_APPROACHES`.
  'SAY:teach':
    'Teach the one idea the child needs for the open item, in two sentences at most, then hand the item back to them.',
  'HINT:point-to-step':
    'Point at the very next step and nothing beyond it. Do not work the step for them.',
  'HINT:worked-similar':
    'Work one easier problem of the same shape all the way through, then leave the open item for the child.',
  'HINT:narrow-choice':
    'Offer two or three possible answers, one of which is right, and ask the child which one it is.',
  'RETEACH:visual-model':
    'Explain the idea again with something the child can picture — a bar, a number line, objects on a table.',
  'RETEACH:concrete-story':
    'Explain the idea again as a small everyday story with real things in it, not symbols.',
  'RETEACH:simpler-case':
    'Explain the idea again using the smallest, easiest case of it, then connect that back to the open item.',
  'ASK:same-item':
    'Ask the open question again in your own words. Ask for the same thing — do not make it easier and do not answer any of it.',
  'ASK:easier-item':
    'Ask a smaller question of the same kind first, easy enough that this child will get it, so they have a foothold before the open item.',
  'ASK:reask-short':
    'Ask the open question again in fewer, friendlier words than you used before. Do not repeat your earlier wording.',
};

export function instructionFor(move: string, approach: string): string {
  const approachInstruction = APPROACH_INSTRUCTIONS[`${move}:${approach}`];
  if (approachInstruction !== undefined) return approachInstruction;
  return isMoveKind(move) ? MOVE_INSTRUCTIONS[move] : 'Say one helpful sentence.';
}

function isMoveKind(value: string): value is MoveKind {
  return Object.hasOwn(MOVE_INSTRUCTIONS, value);
}
