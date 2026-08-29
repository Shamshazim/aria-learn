/**
 * What a child meant when they answered out loud.
 *
 * A tapped choice arrives as its label. A spoken one arrives as "b", "the second one", "um,
 * twelve?" or "I think it's the cat" — and every question must be answerable by voice as well
 * as by tapping, so the words are resolved to the label they name before anything grades them.
 * A text or number question gets the same treatment for a single number word ("seven" → "7").
 *
 * Pure, and deliberately conservative: when the words match nothing, they are returned as
 * said, so a wrong answer is still graded as the child's own answer rather than as a guess.
 */
export type ChoiceOption = Readonly<{ id: string; label: string }>;

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
};

const ORDINALS: Readonly<Record<string, number>> = {
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
  fifth: 4,
  sixth: 5,
  seventh: 6,
  eighth: 7,
  last: -1,
};

const FILLER = /^(?:(?:um+|uh+|er+|hmm+|so|well|okay|ok|yes|yeah)[\s,]+)+/u;
const LEAD =
  /^(?:(?:i think|i say|id say|i guess|maybe|probably|the answer is|its|it is|is it|thats|that is|i choose|i pick|i want|number|option|letter|choice|answer)\s+)+/u;
/** "The second one" names a position; the "one" is not part of it. Choice questions only. */
const ONE = /\s+one$/u;

export function resolveSpokenAnswer(text: string, options: readonly ChoiceOption[]): string {
  const said = clean(text);
  if (said === '') return text.trim();
  if (options.length === 0) return NUMBER_WORDS[said] ?? text.trim();
  const cleaned = said.replace(ONE, '');
  const exact = options.find((option) => matches(option, cleaned));
  if (exact !== undefined) return exact.label;
  const numbered = NUMBER_WORDS[cleaned] ?? cleaned;
  const byNumber = options.find((option) => matches(option, numbered));
  if (byNumber !== undefined) return byNumber.label;
  const indexed = byIndex(numbered, options);
  if (indexed !== undefined) return indexed.label;
  const contained = options.filter((option) => hasWord(cleaned, normalise(option.label)));
  return contained.length === 1 && contained[0] !== undefined ? contained[0].label : text.trim();
}

function byIndex(cleaned: string, options: readonly ChoiceOption[]): ChoiceOption | undefined {
  const ordinal = ORDINALS[cleaned];
  if (ordinal !== undefined) return options.at(ordinal);
  if (/^[a-h]$/u.test(cleaned)) return options[cleaned.charCodeAt(0) - 'a'.charCodeAt(0)];
  // "2" means the second option only when no option is itself a number.
  if (/^[1-8]$/u.test(cleaned) && !options.some((option) => /\d/u.test(option.label))) {
    return options[Number(cleaned) - 1];
  }
  return undefined;
}

function matches(option: ChoiceOption, cleaned: string): boolean {
  return normalise(option.label) === cleaned || normalise(option.id) === cleaned;
}

function hasWord(haystack: string, needle: string): boolean {
  return needle !== '' && ` ${haystack} `.includes(` ${needle} `);
}

function clean(text: string): string {
  return normalise(text)
    .replace(FILLER, '')
    .replace(LEAD, '')
    .replace(/^the\s+/u, '')
    .trim();
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/['\u2019]/gu, '')
    .replace(/[^a-z0-9\s/.-]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
