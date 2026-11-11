import type { Band, EngagementStateKind } from '@aria/shared';

import { foldForMatching } from '../intent/normalise';

/**
 * What Aria asks when she is not sure (P3-05, §4.3: low confidence "causes a check-in, not a
 * declaration").
 *
 * Fixed, reviewed text — no model writes these. Every sentence is a question, so none of them
 * can tell a child what they are feeling: "Do you want an easy one?" never "You are tired."
 * Each offers exactly two answers, which the early band shows as two big buttons and every
 * band accepts out loud.
 */
export type CheckInReply = 'easy' | 'stop' | 'break' | 'switch' | 'help' | 'keep';

export type CheckInOption = Readonly<{ id: CheckInReply; label: string }>;

export type CheckInCopy = Readonly<{
  text: string;
  /** What the `CHECK_IN` move's `about` field says it is asking about. */
  about: 'mood' | 'energy' | 'difficulty' | 'preference';
  options: readonly [CheckInOption, CheckInOption];
}>;

type Asked = Exclude<EngagementStateKind, 'ready'>;

const OPTIONS: Readonly<Record<Asked, readonly [CheckInOption, CheckInOption]>> = {
  tired: [
    { id: 'easy', label: 'An easy one' },
    { id: 'stop', label: 'Stop for today' },
  ],
  frustrated: [
    { id: 'easy', label: 'An easier one' },
    { id: 'break', label: 'A short break' },
  ],
  disengaged: [
    { id: 'switch', label: 'Something different' },
    { id: 'keep', label: 'Keep going' },
  ],
  uncertain: [
    { id: 'help', label: 'Show me how' },
    { id: 'keep', label: 'I can do it' },
  ],
};

const ABOUT: Readonly<Record<Asked, CheckInCopy['about']>> = {
  tired: 'energy',
  frustrated: 'difficulty',
  disengaged: 'preference',
  uncertain: 'difficulty',
};

const TEXT: Readonly<Record<Asked, Readonly<Record<Band, string>>>> = {
  tired: {
    early: 'Do you want an easy one, or should we stop for today?',
    middle: 'Want to do an easy one, or stop for today?',
    senior: 'Do you want something lighter, or shall we stop for today?',
  },
  frustrated: {
    early: 'Is this one feeling tricky? Do you want an easier one, or a little break?',
    middle: 'Is this one getting annoying? Want an easier one, or a quick break?',
    senior: 'Is this one getting frustrating? Want an easier one, or a short break?',
  },
  disengaged: {
    early: 'Do you want to try something different, or keep going?',
    middle: 'Shall we try something different, or keep going with this?',
    senior: 'Want to switch to something different, or keep going with this?',
  },
  uncertain: {
    early: 'Do you want me to show you how, or do you want to try?',
    middle: 'Want me to show you how this one works, or have a go yourself?',
    senior: 'Want me to walk through how this works, or would you rather try it?',
  },
};

export function checkInCopy(state: Asked, band: Band): CheckInCopy {
  return { text: TEXT[state][band], about: ABOUT[state], options: OPTIONS[state] };
}

/** Every reviewed check-in, for the tests that hold the copy to its rules. */
export function allCheckInCopy(): readonly CheckInCopy[] {
  const bands: readonly Band[] = ['early', 'middle', 'senior'];
  return (Object.keys(TEXT) as Asked[]).flatMap((state) =>
    bands.map((band) => checkInCopy(state, band)),
  );
}

const SPOKEN: readonly (readonly [CheckInReply, RegExp])[] = [
  ['stop', /\b(?:stop|finish|done|no more|bed ?time)\b/u],
  ['break', /\bbreak\b/u],
  [
    'keep',
    /\b(?:keep going|keep|go on|i can|i'?m (?:fine|ok|okay|good)|not tired|try it|have a go)\b/u,
  ],
  ['help', /\b(?:show me|help|how)\b/u],
  ['switch', /\b(?:different|something else|change|switch|another thing)\b/u],
  ['easy', /\b(?:easy|easier|small one|little one|lighter)\b/u],
];

/**
 * Which answer the child gave: a tapped option, its id typed back, or a spoken sentence.
 *
 * "Stop" is honoured from any check-in, because a child asking to stop is never argued with,
 * and so is "I'm fine" / "keep going", because a child telling Aria she guessed wrong is the
 * whole point of asking. Anything else counts only if it is one of the two answers this
 * check-in offered; a reply that is neither is `null`, and the turn is treated as whatever it
 * otherwise was.
 */
export function readCheckInReply(
  state: Asked,
  reply: Readonly<{ choiceId?: string | undefined; text?: string | undefined }>,
): CheckInReply | null {
  const offered = OPTIONS[state].map((option) => option.id);
  const chosen = offered.find((id) => id === reply.choiceId || id === reply.text);
  if (chosen !== undefined) return chosen;
  if (reply.text === undefined) return null;
  const folded = foldForMatching(reply.text).toLowerCase().replace(/[’‘]/gu, "'");
  const spoken = SPOKEN.find(([, pattern]) => pattern.test(folded))?.[0] ?? null;
  if (spoken === 'stop' || spoken === 'keep') return spoken;
  return spoken !== null && offered.includes(spoken) ? spoken : null;
}

/** Answers that tell Aria she guessed wrong: the state is cleared and not asked about again. */
export function isDenial(reply: CheckInReply): boolean {
  return reply === 'keep';
}
