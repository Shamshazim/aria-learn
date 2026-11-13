import { describe, expect, it } from 'vitest';

import { checkArithmetic } from '@/quality/arithmetic';
import {
  normaliseAnswer,
  parseInteger,
  parseRational,
  rationalToString,
} from '@/quality/arithmetic/normalise';

/** A deterministic generator, so a failure names a seed that reproduces it. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;

describe('number-sense checkers against an independent reference (P3-07)', () => {
  it('place value: the checker agrees with string indexing, 10,000 times', () => {
    const random = lcg(11);
    for (let run = 0; run < RUNS; run += 1) {
      const number = Math.floor(random() * 9_990) + 10;
      const places = ['ones', 'tens', 'hundreds', 'thousands'] as const;
      const place = places[Math.floor(random() * 4)] ?? 'ones';
      const digits = String(number).padStart(4, '0');
      const reference = digits[3 - places.indexOf(place)] ?? '0';
      const problem = {
        skillCode: 'NUM.PV.HUNDREDS',
        kind: 'place-value',
        number: String(number),
        place,
      } as const;
      expect(checkArithmetic(problem, reference).verdict, `${String(number)} ${place}`).toBe(
        'correct',
      );
      expect(checkArithmetic(problem, String((Number(reference) + 1) % 10)).verdict).toBe(
        'incorrect',
      );
    }
  });

  it('whole comparison: the checker agrees with BigInt comparison, 10,000 times', () => {
    const random = lcg(23);
    for (let run = 0; run < RUNS; run += 1) {
      const left = BigInt(Math.floor(random() * 1_000_000));
      const right = random() < 0.1 ? left : BigInt(Math.floor(random() * 1_000_000));
      const reference = left < right ? '<' : left > right ? '>' : '=';
      const problem = {
        skillCode: 'NUM.CMP.100',
        kind: 'whole-comparison',
        left: left.toString(),
        right: right.toString(),
      } as const;
      expect(checkArithmetic(problem, reference).verdict).toBe('correct');
    }
  });

  it('rounding: the checker agrees with a reference built from division, 10,000 times', () => {
    const random = lcg(37);
    for (let run = 0; run < RUNS; run += 1) {
      const number = BigInt(Math.floor(random() * 100_000));
      // Independent of the solver: halves up via (n + 5) / 10, in integers.
      const reference = ((number + 5n) / 10n) * 10n;
      const problem = {
        skillCode: 'NUM.RND.10',
        kind: 'rounding',
        number: number.toString(),
        to: '10',
      } as const;
      expect(checkArithmetic(problem, reference.toString()).verdict, number.toString()).toBe(
        'correct',
      );
    }
  });
});

describe('answer normalisation (P3-07 edge cases)', () => {
  it.each([
    ['eleven', 11n],
    ['twenty one', 21n],
    ['twenty-one', 21n],
    ['three hundred and five', 305n],
    ['007', 7n],
    ['-0', 0n],
    ['1,200', 1_200n],
  ] as const)('reads %j as %s', (text, value) => {
    expect(parseInteger(text)).toBe(value);
  });

  it.each(['twenty eleven', 'one two', 'lots', ''])('refuses %j as a number', (text) => {
    expect(parseInteger(text)).toBeNull();
  });

  it.each(['1/2', ' 1 / 2 ', '½', 'one half', 'a half', '0.5'])('reads %j as one half', (text) => {
    const parsed = parseRational(normaliseAnswer(text), true);
    expect(parsed === null ? null : rationalToString(parsed)).toBe('1/2');
  });

  it('treats trailing decimal zeros as equal', () => {
    const left = parseRational('0.50', true);
    expect(left === null ? null : rationalToString(left)).toBe('1/2');
  });
});
