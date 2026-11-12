import { foldForMatching } from '@aria/tutor';

/**
 * Describe, never judge (P3-06; the brief lint P3-03 will share).
 *
 * Aria remembers that a child "likes dinosaurs" or "prefers short questions" — things that
 * happened and things they chose. She does not remember that a child "is lazy", "is gifted"
 * or "is bad at maths", because a label written into memory is a label read back into every
 * prompt, and it outlives the week it was true. A parent writing one is asked to rephrase.
 */
const TRAIT = String.raw`(?:lazy|stupid|dumb|naughty|bad|slow|smart|clever|bright|gifted|genius|weird|annoying|difficult|rude|mean|careless|hopeless|useless|spoiled|spoilt)`;

const PATTERNS: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:is|was|being|seems?|acts?)\s+(?:so |really |very |a bit |quite |kind of )?${TRAIT}\b`,
    'u',
  ),
  new RegExp(String.raw`\b${TRAIT}\s+(?:kid|child|boy|girl|learner|student)\b`, 'u'),
  /\bnot\s+(?:very\s+)?(?:smart|clever|bright)\b/u,
  /\b(?:bad|terrible|hopeless|useless)\s+at\b/u,
  /\bcan'?t\s+(?:learn|focus|concentrate|do anything)\b/u,
  /\b(?:iq|intelligence)\b/u,
];

export function judgementIn(text: string): boolean {
  const folded = foldForMatching(text).toLowerCase().replace(/[’‘]/gu, "'");
  return PATTERNS.some((pattern) => pattern.test(folded));
}
