import { describe, expect, it } from 'vitest';

import { spokenForm } from './spoken-form';

describe('spokenForm', () => {
  it.each([
    ['3/4', 'default', 'three fourths'],
    ['/k/', 'phoneme', 'k sound'],
    ['12', 'place-value', 'one two'],
    ['Dr. Lee', 'default', 'Doctor Lee'],
    ['e.g. one', 'default', 'for example one'],
    ['3 × 4 + 1', 'default', '3 times 4 plus 1'],
  ] as const)('rewrites %s for %s speech', (written, context, expected) => {
    expect(spokenForm(written, context)).toBe(expected);
  });
});
