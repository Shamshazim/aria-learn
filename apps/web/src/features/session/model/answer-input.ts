import type { TutorMove } from '@aria/shared';

const NUMERIC_SKILL = /(add|sub|mult|div|count|number|arith|place|fraction|decimal|sum|equal)/iu;
const NUMBER_WORD =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|hundred)\b/iu;

/**
 * The keyboard a typed answer should open with.
 *
 * The protocol says `text` for every open question, so the client has to guess whether a
 * number is wanted. It guesses from what is cheap and already on the move — the skill and the
 * question's own words — and guesses "text" when unsure, because a number keypad cannot type a
 * word but a keyboard can type a number.
 */
export function inputModeFor(move: TutorMove): 'numeric' | 'text' {
  if (move.expects === 'number') return 'numeric';
  if ('skillId' in move && typeof move.skillId === 'string' && NUMERIC_SKILL.test(move.skillId)) {
    return 'numeric';
  }
  const words = [move.speech?.text ?? '', ...move.display.map(displayText)].join(' ');
  return /\d/u.test(words) || NUMBER_WORD.test(words) ? 'numeric' : 'text';
}

function displayText(item: TutorMove['display'][number]): string {
  return item.type === 'text' ? item.body : '';
}
