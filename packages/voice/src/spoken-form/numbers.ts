/**
 * Numbers, read the way a person reads them.
 *
 * A text-to-speech engine will make its own guess at "1,204" or "3:05", and its guess is not
 * always the one a child needs — "one thousand two hundred four" is a number, "one two zero
 * four" is a phone number. The harness controls the text, so the harness decides.
 */

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
] as const;

const SCALES = [
  [1_000_000_000, 'billion'],
  [1_000_000, 'million'],
  [1_000, 'thousand'],
] as const;

/** Ordinals that are not simply the cardinal with a suffix. */
const ORDINAL_WORDS: Readonly<Record<string, string>> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

/** Above this a digit string is an identifier, not a quantity, and is left for the engine. */
const MAX_SPOKEN = 999_999_999_999;

export function cardinal(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_SPOKEN) return String(value);
  if (value < 0) return `negative ${cardinal(-value)}`;
  if (!Number.isInteger(value)) return decimalWords(value);
  return integerWords(value);
}

export function ordinal(value: number): string {
  const words = cardinal(value).split(' ');
  const last = words.at(-1);
  if (last === undefined) return String(value);
  return [...words.slice(0, -1), ordinalWord(last)].join(' ');
}

function ordinalWord(word: string): string {
  const [head, tail] = word.split('-');
  if (head !== undefined && tail !== undefined) return `${head}-${ordinalWord(tail)}`;
  const irregular = ORDINAL_WORDS[word];
  if (irregular !== undefined) return irregular;
  return word.endsWith('y') ? `${word.slice(0, -1)}ieth` : `${word}th`;
}

function integerWords(value: number): string {
  if (value < 20) return ONES[value] ?? String(value);
  if (value < 100) return belowHundred(value);
  if (value < 1_000) return withRemainder(Math.floor(value / 100), 'hundred', value % 100);
  for (const [size, name] of SCALES) {
    if (value >= size) return withRemainder(Math.floor(value / size), name, value % size);
  }
  return String(value);
}

function belowHundred(value: number): string {
  const tens = TENS[Math.floor(value / 10)] ?? '';
  const unit = value % 10;
  return unit === 0 ? tens : `${tens}-${ONES[unit] ?? ''}`;
}

function withRemainder(count: number, scale: string, remainder: number): string {
  const head = `${integerWords(count)} ${scale}`;
  return remainder === 0 ? head : `${head} ${integerWords(remainder)}`;
}

/** "3.5" is "three point five", never "three point fifty": the digits after the point are read. */
function decimalWords(value: number): string {
  const [whole, fraction] = String(value).split('.');
  if (whole === undefined || fraction === undefined) return String(value);
  const digits = Array.from(fraction)
    .map((digit) => ONES[Number(digit)] ?? digit)
    .join(' ');
  return `${integerWords(Number(whole))} point ${digits}`;
}
