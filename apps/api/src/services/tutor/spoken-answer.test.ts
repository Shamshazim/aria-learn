import { describe, expect, it } from 'vitest';

import { resolveSpokenAnswer } from '@/services/tutor/spoken-answer';

const ANIMALS = [
  { id: 'cat', label: 'cat' },
  { id: 'dog', label: 'dog' },
  { id: 'fish', label: 'fish' },
];
const NUMBERS = [
  { id: '10', label: '10' },
  { id: '12', label: '12' },
  { id: '14', label: '14' },
];

describe('a spoken answer to a choice question', () => {
  it.each([
    ['the label itself', 'dog', 'dog'],
    ['the label with filler', 'um, dog?', 'dog'],
    ['the label in a sentence lead', "I think it's the dog", 'dog'],
    ['a letter', 'b', 'dog'],
    ['a letter with a lead', 'letter B', 'dog'],
    ['an ordinal', 'the second one', 'dog'],
    ['the last one', 'the last one', 'fish'],
    ['a position, as a number, when no label is a number', 'number two', 'dog'],
    ['a position, as a digit, when no label is a number', '2', 'dog'],
    ['the only label mentioned', 'maybe the fish because it swims', 'fish'],
  ])('resolves %s', (_label, said, expected) => {
    expect(resolveSpokenAnswer(said, ANIMALS)).toBe(expected);
  });

  it('reads a number word as the numeric label, not as a position', () => {
    expect(resolveSpokenAnswer('twelve', NUMBERS)).toBe('12');
    expect(resolveSpokenAnswer('ten', NUMBERS)).toBe('10');
  });

  it('does not read a digit as a position when the labels are numbers', () => {
    expect(resolveSpokenAnswer('2', NUMBERS)).toBe('2');
  });

  it('returns the words as said when they name nothing on offer', () => {
    expect(resolveSpokenAnswer('a horse', ANIMALS)).toBe('a horse');
    expect(resolveSpokenAnswer('cat or dog', ANIMALS)).toBe('cat or dog');
  });

  it('is what a tapped choice already sends', () => {
    expect(resolveSpokenAnswer('cat', ANIMALS)).toBe('cat');
  });
});

describe('a spoken answer to an open question', () => {
  it('turns a single number word into the digit the key uses', () => {
    expect(resolveSpokenAnswer('seven', [])).toBe('7');
    expect(resolveSpokenAnswer("um, it's seven", [])).toBe('7');
  });

  it('leaves anything else alone', () => {
    expect(resolveSpokenAnswer('  7 ', [])).toBe('7');
    expect(resolveSpokenAnswer('twenty one', [])).toBe('twenty one');
    expect(resolveSpokenAnswer('the big one', [])).toBe('the big one');
  });
});
