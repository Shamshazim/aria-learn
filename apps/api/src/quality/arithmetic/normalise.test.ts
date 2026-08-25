import { describe, expect, it } from 'vitest';

import {
  compareRationals,
  normaliseAnswer,
  parseInteger,
  parseRational,
} from '@/quality/arithmetic/normalise';

describe('arithmetic answer normalisation', () => {
  it.each([
    ['  −03. ', '-03'],
    ['½', '1/2'],
    ['1/2', '1/2'],
  ])('normalises %s explicitly to %s', (input, expected) => {
    expect(normaliseAnswer(input)).toBe(expected);
  });

  it('accepts decimals only when the skill profile permits them', () => {
    expect(parseRational('0.5', false)).toBeNull();
    expect(compareRationals(requiredRational('0.5', true), requiredRational('1/2', false))).toBe(0);
  });

  it('normalises mixed numbers and refuses a zero denominator', () => {
    expect(compareRationals(requiredRational('1 1/2', false), requiredRational('3/2', false))).toBe(
      0,
    );
    expect(parseRational('1/0', false)).toBeNull();
    expect(parseInteger('1.5')).toBeNull();
  });
});

function requiredRational(value: string, allowDecimal: boolean) {
  const parsed = parseRational(value, allowDecimal);
  if (parsed === null) throw new Error(`Expected ${value} to parse`);
  return parsed;
}
