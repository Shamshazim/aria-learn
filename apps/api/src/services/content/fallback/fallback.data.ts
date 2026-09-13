import type { MoveKind } from '@aria/shared';

import {
  ASK_FALLBACKS,
  CHECK_IN_FALLBACKS,
  LISTEN_FALLBACKS,
  RECOMMEND_FALLBACKS,
  SHOW_FALLBACKS,
  WELCOME_FALLBACKS,
} from '@/services/content/fallback/arrival.data';
import { BREAK_FALLBACKS, END_FALLBACKS } from '@/services/content/fallback/closing.data';
import type { BandVariants } from '@/services/content/fallback/fallback.types';
import {
  HINT_FALLBACKS,
  PRAISE_FALLBACKS,
  RETEACH_FALLBACKS,
  REVEAL_FALLBACKS,
  REVEAL_MOVE_ON_FALLBACKS,
  SWITCH_FALLBACKS,
  SWITCH_NEXT_TOPIC_FALLBACKS,
} from '@/services/content/fallback/feedback.data';
import {
  ACKNOWLEDGE_CHAT_FALLBACKS,
  ANSWER_QUESTION_FALLBACKS,
  CHECK_IN_SAY_FALLBACKS,
  CONFIRM_SPOKEN_ANSWER_FALLBACKS,
  REASK_SHORT_FALLBACKS,
  SAY_FALLBACKS,
  TEACH_FALLBACKS,
} from '@/services/content/fallback/say.data';

/**
 * Every static sentence a child can hear, in one place (P2H-11).
 *
 * Exhaustive over `MoveKind` by type, so a new move in the protocol is a compile error here
 * until someone writes six sentences for it in each band. That is what replaced
 * `turn-fallback.ts`, where a move nobody had thought about silently got "Let us try one step."
 */
export const MOVE_FALLBACKS: Readonly<Record<MoveKind, BandVariants>> = {
  WELCOME: WELCOME_FALLBACKS,
  CHECK_IN: CHECK_IN_FALLBACKS,
  RECOMMEND: RECOMMEND_FALLBACKS,
  SAY: SAY_FALLBACKS,
  SHOW: SHOW_FALLBACKS,
  ASK: ASK_FALLBACKS,
  LISTEN: LISTEN_FALLBACKS,
  HINT: HINT_FALLBACKS,
  RETEACH: RETEACH_FALLBACKS,
  REVEAL: REVEAL_FALLBACKS,
  PRAISE: PRAISE_FALLBACKS,
  SWITCH: SWITCH_FALLBACKS,
  BREAK: BREAK_FALLBACKS,
  END: END_FALLBACKS,
};

/** Approaches that change what the move *is*, and so need their own six (P2H-03). */
export const APPROACH_FALLBACKS: Readonly<Record<string, BandVariants>> = {
  'SAY:confirm-spoken-answer': CONFIRM_SPOKEN_ANSWER_FALLBACKS,
  'SAY:answer-question': ANSWER_QUESTION_FALLBACKS,
  'SAY:acknowledge-chat': ACKNOWLEDGE_CHAT_FALLBACKS,
  'SAY:reask-short': REASK_SHORT_FALLBACKS,
  'SAY:check-in': CHECK_IN_SAY_FALLBACKS,
  'SAY:teach': TEACH_FALLBACKS,
  // A reveal because the child asked to move on is a different act from a reveal because they
  // ran out of tries: no "that was a hard one", just the answer and a new question.
  'REVEAL:move-on': REVEAL_MOVE_ON_FALLBACKS,
  // A switch forward, to the next topic, is not a switch back to a prerequisite.
  'SWITCH:next-topic': SWITCH_NEXT_TOPIC_FALLBACKS,
};

/** The fewest variants any key may offer, so no key quietly becomes a loop of two. */
export const MIN_VARIANTS = 6;
