export type SpokenContext = 'default' | 'phoneme' | 'place-value';

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

export function spokenForm(written: string, context: SpokenContext = 'default'): string {
  let spoken = written
    .replace(/\bDr\./gu, 'Doctor')
    .replace(/\be\.g\./gu, 'for example')
    .replace(/\b(\d+)\/(\d+)\b/gu, (_, numerator: string, denominator: string) =>
      speakFraction(numerator, denominator),
    )
    .replace(/\/([a-z])\//giu, (_, phoneme: string) => `${phoneme.toLowerCase()} sound`)
    .replaceAll('×', ' times ')
    .replaceAll('÷', ' divided by ')
    .replaceAll('+', ' plus ')
    .replaceAll('−', ' minus ');

  if (context === 'place-value') {
    spoken = spoken.replace(/\b\d+\b/gu, (digits) =>
      Array.from(digits)
        .map((digit) => NUMBER_WORDS[digit] ?? digit)
        .join(' '),
    );
  }
  return spoken.replace(/\s+/gu, ' ').trim();
}

function speakFraction(numerator: string, denominator: string): string {
  const top = NUMBER_WORDS[numerator] ?? numerator;
  const base = FRACTION_DENOMINATORS[denominator] ?? `${denominator}th`;
  return `${top} ${numerator === '1' ? base : `${base}s`}`;
}
