/**
 * The closed vocabulary of things Aria may say a child did (P2H-11).
 *
 * Praise is only worth anything if it is true, and a model asked to be specific will invent a
 * strategy the child never used — "you counted on from the bigger number" to a child who
 * guessed. So the strategies Aria can name are a fixed list: the turn says which of them
 * actually happened, and the gate refuses any of the others.
 *
 * `cues` are how the *text* betrays the claim, not how the claim is worded to the model. They
 * are deliberately narrow: a cue that fires on ordinary tutoring words would send a true
 * praise back for regeneration.
 */
export type StrategyClaim = Readonly<{
  id: string;
  /** How the claim is offered to the model, in Aria's own register. */
  says: string;
  /** What in the finished sentence means the claim was made. */
  cues: readonly RegExp[];
}>;

export const STRATEGY_CLAIMS: readonly StrategyClaim[] = [
  {
    id: 'counted-on',
    says: 'counted on from the bigger number',
    cues: [/counted on|counting on|counted up/u],
  },
  {
    id: 'used-a-number-line',
    says: 'used the number line',
    cues: [/number line/u],
  },
  {
    id: 'made-ten',
    says: 'made a ten first',
    cues: [/made a ten|make a ten|made ten/u],
  },
  {
    id: 'lined-up-place-value',
    says: 'lined up the tens and the ones',
    cues: [/lined up the (?:tens|ones|digits)|kept the columns/u],
  },
  {
    id: 'regrouped',
    says: 'regrouped when the ones went past nine',
    cues: [/regrouped|carried the ten|traded ten/u],
  },
  {
    id: 'same-size-pieces',
    says: 'checked that the pieces were the same size',
    cues: [/same[- ]size|same[- ]sized/u],
  },
  {
    id: 'common-denominator',
    says: 'made the denominators match before comparing',
    cues: [/common denominator|same denominator|same bottom number/u],
  },
  {
    id: 'skip-counted',
    says: 'skip counted to keep the pattern going',
    cues: [/skip[- ]count/u],
  },
  {
    id: 'sounded-it-out',
    says: 'sounded the word out',
    cues: [/sounded it out|sounding it out|sounded out/u],
  },
  {
    id: 'blended-the-sounds',
    says: 'blended the sounds together',
    cues: [/blended|blending/u],
  },
  {
    id: 'used-the-picture',
    says: 'used the picture to work it out',
    cues: [/used the picture|looked at the picture|used the model|used the bar/u],
  },
  {
    id: 'checked-your-work',
    says: 'went back and checked the answer',
    cues: [/checked (?:it|your|the) (?:work|answer|again)|went back over/u],
  },
  {
    id: 'tried-another-way',
    says: 'tried a second way after the first one did not work',
    cues: [/tried (?:a|another) (?:second |different |other )?way|tried it another way/u],
  },
  {
    id: 'kept-going',
    says: 'kept going after a hard one',
    cues: [/kept going|kept trying|stuck with it|did not give up|didn't give up/u],
  },
  {
    id: 'explained-your-thinking',
    says: 'said how you worked it out',
    cues: [/explained|told me how|said why|showed your (?:thinking|working)/u],
  },
  {
    id: 'answered-quickly',
    says: 'knew it straight away',
    cues: [/straight away|right away|without stopping|knew it at once/u],
  },
];

/**
 * Praise that says nothing, and praise that rates the child instead of the work (P2H-11).
 *
 * `master-plan.md` §4.1 asks for specific praise. "Good job" is the thing it is asking us not
 * to say, and "you are so smart" is worse than empty: it tells a child that the next hard
 * problem is evidence about them.
 */
export const EMPTY_PRAISE: readonly RegExp[] = [
  /\bgood job\b/u,
  /\bgreat job\b/u,
  /\bnice job\b/u,
  /\bnice work\b/u,
  /\bgreat work\b/u,
  /\bgood work\b/u,
  /\bwell done\b/u,
  /\bawesome\b/u,
  /\bamazing\b/u,
  /\bsuperstar\b/u,
  /\bsmart\b/u,
  /\bclever\b/u,
  /\bgenius\b/u,
  /\bbrilliant\b/u,
  /\bso good at\b/u,
];
