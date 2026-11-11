import { foldForMatching } from '../intent/normalise';

import type { EngagementSignal, EngagementSignalName } from './types';

/**
 * What a child says about themselves (P3-05): "I'm tired", "this is boring", "I'm fine".
 *
 * Patterns, not a model, and only first-person ones. "The tired dog slept" is an answer to a
 * reading question, not a statement about the reader, so a state word counts only after "I'm",
 * "I feel", "so", "this is" and the like. A denial is checked first: "I'm not tired" must
 * never read as "tired".
 */
const SELF = String.raw`(?:i'?m|i am|im|i feel|i'?m feeling|so|really|too|this is|that'?s|it'?s)`;
const DEGREE = String.raw`(?:really |so |very |kind of |a bit |a little )?`;

const DENIAL = [
  /\b(?:not|n'?t)\s+(?:really\s+)?(?:tired|sleepy|bored|frustrated)\b/u,
  /\b(?:i'?m|i am|im)\s+(?:fine|ok|okay|good|alright|all right)\b/u,
];

const STATEMENTS: readonly (readonly [EngagementSignalName, RegExp])[] = [
  [
    'said_tired',
    new RegExp(String.raw`\b${SELF} ${DEGREE}(?:tired|sleepy|exhausted|worn out)\b`, 'u'),
  ],
  ['said_bored', new RegExp(String.raw`\b${SELF} ${DEGREE}(?:bored|boring)\b`, 'u')],
  [
    'said_frustrated',
    new RegExp(String.raw`\b${SELF} ${DEGREE}(?:frustrated|frustrating|annoyed|annoying)\b`, 'u'),
  ],
  ['said_frustrated', /\bi (?:hate|can'?t stand) this\b/u],
];

/** The signal a sentence carries about the child, or `null` when it says nothing about them. */
export function statementSignal(text: string, at: Date): EngagementSignal | null {
  const folded = foldForMatching(text).toLowerCase().replace(/[’‘]/gu, "'");
  if (DENIAL.some((pattern) => pattern.test(folded))) return { name: 'said_fine', at };
  const match = STATEMENTS.find(([, pattern]) => pattern.test(folded));
  return match === undefined ? null : { name: match[0], at };
}
