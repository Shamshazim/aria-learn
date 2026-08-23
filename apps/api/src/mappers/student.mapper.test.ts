import { describe, expect, it } from 'vitest';

import { toStudent } from './student.mapper';

import type { StudentRow } from './student.mapper';

const row: StudentRow = {
  id: '00000000-0000-4000-8000-000000000001',
  parent_id: '00000000-0000-4000-8000-000000000002',
  display_name: 'Sam',
  grade: '4',
  band: 'middle',
  created_at: new Date('2026-08-22T10:00:00Z'),
};

describe('toStudent', () => {
  it('maps every column to its domain field', () => {
    expect(toStudent(row)).toEqual({
      id: row.id,
      parentId: row.parent_id,
      displayName: 'Sam',
      grade: '4',
      band: 'middle',
      createdAt: row.created_at,
    });
  });

  it('does not carry a column the domain type has no field for', () => {
    const withExtra = { ...row, password_hash: 'nope' } as StudentRow;

    expect(Object.keys(toStudent(withExtra))).not.toContain('password_hash');
  });

  it('refuses a grade outside the shared vocabulary rather than widening the type', () => {
    expect(() => toStudent({ ...row, grade: '9' })).toThrow(/student.grade/);
  });

  it('refuses a band outside the shared vocabulary', () => {
    expect(() => toStudent({ ...row, band: 'teenage' })).toThrow(/student.band/);
  });

  it('says which row it could not map, without repeating the offending value', () => {
    try {
      toStudent({ ...row, grade: 'year 6' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(row.id);
      expect((error as Error).message).not.toContain('year 6');
    }
  });
});
