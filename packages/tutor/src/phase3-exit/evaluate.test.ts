import { describe, expect, it } from 'vitest';

import { evaluatePhase3Exit } from './evaluate';

import type { CriterionId, Phase3ExitEvidence } from './types';

const AT = '2026-11-14T12:00:00.000Z';
const RECENT = '2026-11-01T12:00:00.000Z';
const STALE = '2026-08-01T12:00:00.000Z';

const times = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_u, index) => make(index));

/** Evidence on which every criterion passes; each test breaks one thing. */
function passing(): Phase3ExitEvidence {
  return {
    evaluatedAt: AT,
    automated: {
      welcomes: { cohort: 20, evidenceBacked: 20 },
      arrivalVisibleP95Ms: 310,
      inventedClaims: { scenarios: 2, unsupported: 0 },
      evidenceLinks: {
        facts: 40,
        factsWithoutEvidence: 0,
        episodes: 12,
        episodesWithoutEvidence: 0,
      },
      correctionScenarioPassed: true,
      tiredScenario: { adapted: true, stateLabelsAsserted: 0 },
      engagementFactsCreated: 0,
      rebuild: { students: 20, maxDrift: 0.02 },
      approachUnchangedAfterTwoWrong: 0,
      lowConfidenceAffectAsFact: 0,
    },
    human: {
      welcomeConfirmations: times(10, (i) => ({
        childId: `c${String(i)}`,
        welcomeWasTrue: true,
        recordedAt: RECENT,
      })),
      briefReviews: times(50, (i) => ({
        briefId: `b${String(i)}`,
        unsupportedClaims: 0,
        recordedAt: RECENT,
      })),
      corrections: times(5, (i) => ({
        childId: `c${String(i)}`,
        reflectedNextSession: true,
        recordedAt: RECENT,
      })),
      checkInRatings: times(10, (i) => ({
        transcriptId: `t${String(i)}`,
        warmAndAppropriate: true,
        recordedAt: RECENT,
      })),
      protocolChildren: (['early', 'middle', 'senior'] as const).flatMap((band) =>
        times(3, (i) => ({
          childId: `${band}${String(i)}`,
          band,
          weeksOfUse: 2,
          recordedAt: RECENT,
        })),
      ),
    },
  };
}

type Mutation = (evidence: Phase3ExitEvidence) => Phase3ExitEvidence;

const withAutomated =
  (patch: Partial<Phase3ExitEvidence['automated']>): Mutation =>
  (evidence) => ({
    ...evidence,
    automated: { ...evidence.automated, ...patch },
  });
const withHuman =
  (patch: Partial<Phase3ExitEvidence['human']>): Mutation =>
  (evidence) => ({
    ...evidence,
    human: { ...evidence.human, ...patch },
  });

function statusOf(id: CriterionId, mutate: Mutation = (evidence) => evidence) {
  return evaluatePhase3Exit(mutate(passing())).results.find((result) => result.id === id)?.status;
}

const CASES: readonly (readonly [CriterionId, Mutation, Mutation])[] = [
  [
    'opens-knowing-child',
    withAutomated({ welcomes: { cohort: 20, evidenceBacked: 19 } }),
    withAutomated({ arrivalVisibleP95Ms: null }),
  ],
  [
    'no-invented-facts',
    withAutomated({ inventedClaims: { scenarios: 2, unsupported: 1 } }),
    withAutomated({ inventedClaims: null }),
  ],
  [
    'claims-link-to-evidence',
    withAutomated({
      evidenceLinks: {
        facts: 40,
        factsWithoutEvidence: 1,
        episodes: 12,
        episodesWithoutEvidence: 0,
      },
    }),
    withAutomated({ evidenceLinks: null }),
  ],
  [
    'correction-next-session',
    withAutomated({ correctionScenarioPassed: false }),
    withAutomated({ correctionScenarioPassed: null }),
  ],
  [
    'adapts-without-label',
    withAutomated({ tiredScenario: { adapted: true, stateLabelsAsserted: 1 } }),
    withAutomated({ engagementFactsCreated: null }),
  ],
  [
    'rebuild-drift',
    withAutomated({ rebuild: { students: 20, maxDrift: 0.06 } }),
    withAutomated({ rebuild: null }),
  ],
  [
    'bar-approach-changes',
    withAutomated({ approachUnchangedAfterTwoWrong: 1 }),
    withAutomated({ approachUnchangedAfterTwoWrong: null }),
  ],
  [
    'bar-affect-not-fact',
    withAutomated({ lowConfidenceAffectAsFact: 2 }),
    withAutomated({ lowConfidenceAffectAsFact: null }),
  ],
  ['human-protocol', withHuman({ protocolChildren: [] }), withHuman({ protocolChildren: [] })],
];

describe('the Phase 3 exit gate (P3-08)', () => {
  it('passes only when every criterion has passed', () => {
    const report = evaluatePhase3Exit(passing());
    expect(report.results.filter((result) => result.status !== 'passed')).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it.each(CASES)('%s: passes, fails and goes missing on its own evidence', (id, fail, gone) => {
    expect(statusOf(id)).toBe('passed');
    // The protocol has no failing state of its own: too few children is missing evidence.
    expect(statusOf(id, fail)).toBe(id === 'human-protocol' ? 'missing' : 'failed');
    expect(statusOf(id, gone)).toBe('missing');
    expect(evaluatePhase3Exit(fail(passing())).passed).toBe(false);
  });

  it('reports a cohort under twenty as an insufficient sample, never a pass', () => {
    expect(
      statusOf(
        'opens-knowing-child',
        withAutomated({ welcomes: { cohort: 12, evidenceBacked: 12 } }),
      ),
    ).toBe('insufficient_sample');
  });

  it('fails on human evidence too: a welcome a parent says is untrue, a correction that did not hold', () => {
    const untrue = withHuman({
      welcomeConfirmations: times(10, (i) => ({
        childId: `c${String(i)}`,
        welcomeWasTrue: i !== 3,
        recordedAt: RECENT,
      })),
    });
    expect(statusOf('opens-knowing-child', untrue)).toBe('failed');
    const lapsed = withHuman({
      corrections: times(5, (i) => ({
        childId: `c${String(i)}`,
        reflectedNextSession: i !== 0,
        recordedAt: RECENT,
      })),
    });
    expect(statusOf('correction-next-session', lapsed)).toBe('failed');
    const cold = withHuman({
      checkInRatings: times(10, (i) => ({
        transcriptId: `t${String(i)}`,
        warmAndAppropriate: i > 1,
        recordedAt: RECENT,
      })),
    });
    expect(statusOf('adapts-without-label', cold)).toBe('failed');
  });

  it('drops observations older than sixty days, or dated in the future', () => {
    const stale = withHuman({
      briefReviews: times(50, (i) => ({
        briefId: `b${String(i)}`,
        unsupportedClaims: 0,
        recordedAt: STALE,
      })),
    });
    expect(statusOf('no-invented-facts', stale)).toBe('missing');
    const future = withHuman({
      corrections: times(5, (i) => ({
        childId: `c${String(i)}`,
        reflectedNextSession: true,
        recordedAt: '2027-01-01T00:00:00.000Z',
      })),
    });
    expect(statusOf('correction-next-session', future)).toBe('missing');
  });

  it('lets a failure outrank a gap, so a broken criterion is never hidden behind missing evidence', () => {
    const both = (evidence: Phase3ExitEvidence) =>
      withHuman({ corrections: [] })(withAutomated({ correctionScenarioPassed: false })(evidence));
    expect(statusOf('correction-next-session', both)).toBe('failed');
  });

  it('never treats an empty database as proof: no facts to check is an insufficient sample', () => {
    const empty = withAutomated({
      evidenceLinks: { facts: 0, factsWithoutEvidence: 0, episodes: 0, episodesWithoutEvidence: 0 },
    });
    expect(statusOf('claims-link-to-evidence', empty)).toBe('insufficient_sample');
  });
});
