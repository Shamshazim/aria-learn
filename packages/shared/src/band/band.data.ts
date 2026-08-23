/**
 * Every grade the product serves, in teaching order, and the band each one is rendered in.
 *
 * A table rather than a range check, because the boundaries are a product decision and not
 * arithmetic: they were chosen so a grade 8 student never meets the TK layout and stops
 * trusting the app, and a TK child never meets a layout they cannot read. Moving a boundary
 * is a one-line edit here, reviewable on its own.
 *
 * This file imports nothing on purpose. Data does not depend on behaviour, and keeping it
 * that way is what stops `band.ts` and `band.data.ts` forming a cycle.
 */

/** The grades in teaching order. The source of truth for the `Grade` union. */
export const GRADES = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type Grade = (typeof GRADES)[number];

/**
 * Grade to band. `band.ts` annotates its return as `Band`, so a typo in a value here is a
 * compile error rather than a child seeing the wrong layout; `band.test.ts` asserts these
 * keys stay in step with `GRADES`.
 */
export const GRADE_TO_BAND = {
  TK: 'early',
  K: 'early',
  '1': 'early',
  '2': 'early',
  '3': 'middle',
  '4': 'middle',
  '5': 'middle',
  '6': 'senior',
  '7': 'senior',
  '8': 'senior',
} as const;
