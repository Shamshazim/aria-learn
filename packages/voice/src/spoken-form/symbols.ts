/**
 * The characters a child would never say out loud: operators, abbreviations, fractions and
 * the phoneme slashes the phonics lessons are written in.
 */

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

const FRACTION_DENOMINATORS: Readonly<Record<string, string>> = {
  '2': 'half',
  '3': 'third',
  '4': 'fourth',
  '5': 'fifth',
  '6': 'sixth',
  '7': 'seventh',
  '8': 'eighth',
  '9': 'ninth',
  '10': 'tenth',
};

export function speakSymbols(text: string): string {
  return (
    text
      .replace(/\bDr\./gu, 'Doctor')
      .replace(/\bMr\./gu, 'Mister')
      .replace(/\bMrs\./gu, 'Missus')
      .replace(/\be\.g\./gu, 'for example')
      .replace(/\bi\.e\./gu, 'that is')
      .replace(/\b(\d+)\/(\d+)\b/gu, (_match, numerator: string, denominator: string) =>
        speakFraction(numerator, denominator),
      )
      .replace(/\/([a-z]+)\//giu, (_match, phoneme: string) => `${phoneme.toLowerCase()} sound`)
      // "3 x 4" is multiplication; "box x 4" is a letter, so both sides must be digits.
      .replace(/(\d)\s*[x×]\s*(\d)/giu, '$1 times $2')
      .replaceAll('×', ' times ')
      .replaceAll('÷', ' divided by ')
      .replaceAll('+', ' plus ')
      .replaceAll('−', ' minus ')
      .replaceAll('=', ' equals ')
      // A spaced hyphen between digits is subtraction; "5 - 3" is not "five dash three".
      .replace(/(\d)\s+-\s+(\d)/gu, '$1 minus $2')
      .replace(/(^|[\s(])-(\d)/gu, '$1negative $2')
  );
}

/** Place value is read digit by digit: "12" is "one two", because that is the lesson. */
export function speakPlaceValue(text: string): string {
  return text.replace(/\b\d+\b/gu, (digits) =>
    Array.from(digits)
      .map((digit) => NUMBER_WORDS[digit] ?? digit)
      .join(' '),
  );
}

function speakFraction(numerator: string, denominator: string): string {
  const top = NUMBER_WORDS[numerator] ?? numerator;
  const base = FRACTION_DENOMINATORS[denominator] ?? `${denominator}th`;
  return `${top} ${numerator === '1' ? base : `${base}s`}`;
}
