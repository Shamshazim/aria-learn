import { describe, expect, it } from 'vitest';

import { measureReadability, readabilityFailures } from '@/quality/checks/level/readability';
import { countSyllables } from '@/quality/checks/level/syllables';

const codes = (text: string, band: 'early' | 'middle' | 'senior'): readonly string[] =>
  readabilityFailures(measureReadability(text), band).map((failure) => failure.code);

describe('syllable counter', () => {
  it.each([
    ['cat', 1],
    ['seven', 2],
    ['make', 1],
    ['little', 2],
    ['because', 2],
    ['together', 3],
    ['paragraph', 3],
    ['sophisticated', 5],
    ['the', 1],
  ])('%s has %i syllables', (word, expected) => {
    expect(countSyllables(word)).toBe(expected);
  });
});

describe('readability', () => {
  it.each([
    'I can help. We can look at it together.',
    'Thanks for telling me. Now back to our question.',
    'Are you still there? Say or tap something so I know.',
    'No rush. What do you think the answer is?',
    "I didn't catch that. Can you say it again?",
    'You counted the apples one by one. That is exactly how it works.',
    'Write one paragraph.',
  ])('accepts natural early-band tutor speech: %s', (text) => {
    expect(codes(text, 'early')).toEqual([]);
  });

  it('rejects dense, long sentences for the early band', () => {
    expect(
      codes(
        'Interpret the sophisticated relationship because the argument needs evidence and support and contrast and reason.',
        'early',
      ),
    ).toEqual(['sentence_too_long', 'readability']);
  });

  it('lets the senior band read what the early band cannot', () => {
    const text =
      'Consider why the denominator stays the same when you add fractions with equal parts.';
    expect(codes(text, 'senior')).toEqual([]);
    expect(codes(text, 'early')).toContain('readability');
  });

  it('ignores digits and treats a contraction as one word', () => {
    const metrics = measureReadability("Let's add 12 and 3.");
    expect(metrics.words).toBe(3);
  });
});
