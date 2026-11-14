import { failed, missing, ok, type Finding } from './automated';
import { fresh } from './fresh';
import { THRESHOLDS } from './thresholds';

import type { Band, HumanEvidence, Observation } from './types';

/**
 * The human halves (§11: "a model grading its own tutoring is not acceptance"). Too few fresh
 * observations is `missing`, not a pass on what there is.
 */
export function welcomeConfirmations(human: HumanEvidence, at: string): Finding {
  return countAndAll(
    fresh(human.welcomeConfirmations, at),
    THRESHOLDS.welcomeConfirmations,
    'parent welcome confirmations',
    (row) => row.welcomeWasTrue,
  );
}

export function briefReviews(human: HumanEvidence, at: string): Finding {
  return countAndAll(
    fresh(human.briefReviews, at),
    THRESHOLDS.briefReviews,
    'reviewed briefs',
    (row) => row.unsupportedClaims === 0,
  );
}

export function corrections(human: HumanEvidence, at: string): Finding {
  return countAndAll(
    fresh(human.corrections, at),
    THRESHOLDS.parentCorrections,
    'parent corrections',
    (row) => row.reflectedNextSession,
  );
}

export function checkInRatings(human: HumanEvidence, at: string): Finding {
  const rows = fresh(human.checkInRatings, at);
  if (rows.length < THRESHOLDS.checkInRatings) {
    return missing(
      `${String(rows.length)} fresh check-in ratings; ${String(THRESHOLDS.checkInRatings)} are needed.`,
    );
  }
  const rate = rows.filter((row) => row.warmAndAppropriate).length / rows.length;
  return rate >= THRESHOLDS.checkInWarmRate
    ? ok(`${(rate * 100).toFixed(0)}% of check-ins rated warm and appropriate.`)
    : failed(
        `${(rate * 100).toFixed(0)}% of check-ins rated warm and appropriate; the bar is 90%.`,
      );
}

export function protocolChildren(human: HumanEvidence, at: string): Finding {
  const rows = fresh(human.protocolChildren, at).filter(
    (row) => row.weeksOfUse >= THRESHOLDS.minimumWeeksOfUse,
  );
  const short = (['early', 'middle', 'senior'] as const satisfies readonly Band[]).filter(
    (band) =>
      new Set(rows.filter((row) => row.band === band).map((row) => row.childId)).size <
      THRESHOLDS.childrenPerBand,
  );
  return short.length === 0
    ? ok('At least three children per band observed after two weeks or more.')
    : missing(`Too few children observed after two weeks in: ${short.join(', ')}.`);
}

function countAndAll<T>(
  rows: readonly Observation<T>[],
  needed: number,
  what: string,
  good: (row: Observation<T>) => boolean,
): Finding {
  if (rows.length < needed)
    return missing(`${String(rows.length)} fresh ${what}; ${String(needed)} are needed.`);
  const bad = rows.filter((row) => !good(row)).length;
  return bad === 0
    ? ok(`${String(rows.length)} ${what}, all good.`)
    : failed(`${String(bad)} of ${String(rows.length)} ${what} were not.`);
}
