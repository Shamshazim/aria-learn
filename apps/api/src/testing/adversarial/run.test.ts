import { describe, expect, it } from 'vitest';

import { loadAdversarialFixtures } from '@/testing/adversarial/load';
import { runAdversarialSuite } from '@/testing/adversarial/run';

/**
 * X-05: "the adversarial suite runs in `npm test` with ≥ 60 fixtures across the three families
 * and every invariant holds."
 *
 * It runs here, in the ordinary suite, and not behind a flag. A safety suite that has to be
 * remembered is a safety suite that gets run the week it is written and never again.
 */
const MINIMUM_FIXTURES = 60;

describe('the adversarial suite', () => {
  const fixtures = loadAdversarialFixtures();

  it('has enough cases, across all three families, to be worth running', () => {
    expect(fixtures.injection.length).toBeGreaterThanOrEqual(20);
    expect(fixtures.parentAsk.length).toBeGreaterThanOrEqual(5);
    expect(fixtures.realtime.length).toBeGreaterThanOrEqual(15);
    expect(
      fixtures.injection.length + fixtures.parentAsk.length + fixtures.realtime.length,
    ).toBeGreaterThanOrEqual(MINIMUM_FIXTURES);
  });

  it('holds every invariant on every fixture', async () => {
    const report = await runAdversarialSuite(fixtures);

    // Reported as the whole list rather than one failure at a time: when a change breaks the
    // safety layer it usually breaks it in several places, and seeing one of them is misleading.
    expect(report.results.filter((result) => result.violations.length > 0)).toEqual([]);
    expect(report.fixtureCount).toBeGreaterThanOrEqual(MINIMUM_FIXTURES);
  });

  /**
   * The suite has to be able to fail. An invariant list that passes on a deliberately broken
   * outcome is a list of comments.
   */
  it('fails when an invariant is actually broken', async () => {
    const report = await runAdversarialSuite({
      ...fixtures,
      realtime: [
        {
          id: 'proof-that-this-suite-can-fail',
          note: 'A frame that plainly parses, declared as one that must not.',
          frame: { kind: 'SPEECH_STARTED' },
          expectRejected: true,
        },
      ],
    });

    expect(report.passed).toBe(false);
    expect(report.results.at(-1)?.violations).toEqual([
      { invariant: 'malformed-frames-never-parse', reason: 'the frame was accepted' },
    ]);
  });
});
