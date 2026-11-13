/**
 * Number words, for answers typed in words or spoken (P3-07): "eleven", "twenty one",
 * "twenty-one", "three hundred and five". Whole numbers below a thousand, which is the range a
 * child says out loud; anything else is `null`, and the caller treats the answer as not a number.
 */
const UNITS: Readonly<Record<string, number>> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Readonly<Record<string, number>> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

export function wordsToInteger(text: string): bigint | null {
  const words = text
    .toLowerCase()
    .replace(/-/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word !== '' && word !== 'and');
  if (words.length === 0) return null;
  let state: Reading | null = { value: 0, hundred: false };
  for (const word of words) {
    if (state === null) return null;
    state = read(state, word);
  }
  return state === null ? null : BigInt(state.value);
}

type Reading = Readonly<{ value: number; hundred: boolean }>;

/** One more word of the number, or `null` where it cannot follow what came before. */
function read(state: Reading, word: string): Reading | null {
  const { value } = state;
  const unit = UNITS[word];
  if (unit !== undefined) {
    const fits = value % 10 === 0 && (value % 100 === 0 || unit < 10);
    return fits ? { ...state, value: value + unit } : null;
  }
  const ten = TENS[word];
  if (ten !== undefined) return value % 100 === 0 ? { ...state, value: value + ten } : null;
  if (word === 'hundred' && !state.hundred && value > 0 && value < 10) {
    return { value: value * 100, hundred: true };
  }
  return null;
}

/** Spoken and typed fractions: "a half", "one half", "three quarters". */
const FRACTION_WORDS: Readonly<Record<string, string>> = {
  'a half': '1/2',
  'one half': '1/2',
  half: '1/2',
  'a third': '1/3',
  'one third': '1/3',
  'two thirds': '2/3',
  'a quarter': '1/4',
  'one quarter': '1/4',
  'a fourth': '1/4',
  'one fourth': '1/4',
  'three quarters': '3/4',
  'three fourths': '3/4',
};

export function wordsToFraction(text: string): string | null {
  return FRACTION_WORDS[text.toLowerCase().replace(/\s+/gu, ' ').trim()] ?? null;
}
