import type { TutorMove } from '@aria/shared';

import type { SessionState } from '@/features/session/model/session-state';

/**
 * What is on the screen: the cards to show and the one move the answer control belongs to.
 *
 * The open question owns the answer control. While it is open, a hint, a praise line, a
 * picture or something Aria put up to read is shown as a card above it, and the question
 * itself — its prompt, its choices, its typing box — stays exactly where it was, keyed by the
 * same id, so nothing the child was about to tap moves under their finger. The one thing that
 * may change the control is a writing pad Aria opened for a question that expects typed
 * words: it dresses that question, and what is written in it is the answer to it.
 */
export type ScreenComposition = Readonly<{
  cards: readonly TutorMove[];
  /** The move whose `expects` picks the control and whose id an answer responds to. */
  input: TutorMove | null;
}>;

export function composeScreen(
  state: Pick<SessionState, 'currentMove' | 'openQuestion'>,
): ScreenComposition {
  const current = state.currentMove;
  const question = state.openQuestion;
  if (current === null) return { cards: [], input: null };
  if (question === null || question.id === current.id) return { cards: [current], input: current };
  if (dressesQuestion(current, question)) {
    return { cards: [current], input: { ...question, display: current.display } };
  }
  return { cards: [current, question], input: question };
}

/** A writing pad Aria opened for the open question: same question, a bigger place to answer. */
export function dressesQuestion(shown: TutorMove, question: TutorMove): boolean {
  return (
    shown.kind === 'SHOW' &&
    question.expects === 'text' &&
    shown.display.some((item) => item.type === 'workpad' && item.mode === 'answer')
  );
}
