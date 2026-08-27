import { describe, expect, it } from 'vitest';

import { spokenForm } from '@/ai/streaming';

/**
 * The API re-exports `spokenForm` so the model layer has one way to reach it. The fixtures
 * that prove what it does live in `@aria/voice`; these prove the door is still open and that
 * a gated segment leaves here as words rather than as symbols (P2H-08).
 */
describe('spokenForm', () => {
  it.each([
    ['3/4', 'default', 'three fourths'],
    ['/k/', 'phoneme', 'k sound'],
    ['12', 'place-value', 'one two'],
    ['Dr. Lee', 'default', 'Doctor Lee'],
    ['3 × 4 + 1', 'default', 'three times four plus one'],
    ['Count the *shapes*.', 'default', 'Count the [[emphasis]]shapes[[/emphasis]].'],
  ] as const)('rewrites %s for %s speech', (written, context, expected) => {
    expect(spokenForm(written, context)).toBe(expected);
  });
});
