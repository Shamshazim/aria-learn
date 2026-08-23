import { describe, expect, it } from 'vitest';

import { BANDS, GRADES, bandForGrade, parseGrade, type Band, type Grade } from './band';
import { GRADE_TO_BAND } from './band.data';

/**
 * Table-driven, because the band boundaries are a product decision: a grade 8 student must
 * never meet the TK layout, and a TK child must never meet a layout they cannot read.
 */
const EXPECTED: readonly (readonly [Grade, Band])[] = [
  ['TK', 'early'],
  ['K', 'early'],
  ['1', 'early'],
  ['2', 'early'],
  ['3', 'middle'],
  ['4', 'middle'],
  ['5', 'middle'],
  ['6', 'senior'],
  ['7', 'senior'],
  ['8', 'senior'],
];

describe('bandForGrade', () => {
  it.each(EXPECTED)('renders grade %s in the %s band', (grade, band) => {
    expect(bandForGrade(grade)).toBe(band);
  });

  it('covers TK through grade 8 and nothing else', () => {
    expect(GRADES).toHaveLength(10);
    expect([...GRADES].sort()).toEqual([...EXPECTED.map(([g]) => g)].sort());
  });

  it('keeps the grade list and the band table in step', () => {
    expect(Object.keys(GRADE_TO_BAND).sort()).toEqual([...GRADES].sort());
  });

  it('only ever returns a declared band', () => {
    for (const grade of GRADES) {
      expect(BANDS).toContain(bandForGrade(grade));
    }
  });

  it('puts each boundary on the intended side', () => {
    expect(bandForGrade('2')).toBe('early');
    expect(bandForGrade('3')).toBe('middle');
    expect(bandForGrade('5')).toBe('middle');
    expect(bandForGrade('6')).toBe('senior');
  });
});

describe('parseGrade', () => {
  it.each(GRADES)('accepts %s', (grade) => {
    expect(parseGrade(grade)).toBe(grade);
  });

  it.each([['9'], ['0'], ['grade 3'], [''], ['tk']])('rejects %j', (value) => {
    expect(parseGrade(value)).toBeNull();
  });

  it.each([[null], [undefined], [3], [{}], [['3']]])('rejects the non-string %j', (value) => {
    expect(parseGrade(value)).toBeNull();
  });
});
