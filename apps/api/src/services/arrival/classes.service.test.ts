import { describe, expect, it } from 'vitest';

import { createInventoryService } from '@/curriculum';
import { DEFAULT_STUDENT_SETTINGS } from '@/mappers/student.mapper';
import { classesFor } from '@/services/arrival/classes.service';
import type { Student } from '@/types/student';

function student(grade: Student['grade'], band: Student['band']): Student {
  return {
    id: 'student-1',
    parentId: 'parent-1',
    displayName: 'Sam',
    grade,
    band,
    settings: DEFAULT_STUDENT_SETTINGS,
    createdAt: new Date('2026-08-24T20:00:00.000Z'),
  };
}

const CORE = [
  'Mathematics',
  'English Reading',
  'English Writing',
  'Science',
  'History-Social Science',
];

describe('the classes a child can open', () => {
  const inventory = createInventoryService();

  it('lists the five California subjects, maths first, for a grade-4 child', () => {
    expect(classesFor(inventory, student('4', 'middle'))).toEqual([
      { subjectId: 'mathematics', name: 'Mathematics', grade: '4' },
      { subjectId: 'english-reading', name: 'English Reading', grade: '4' },
      { subjectId: 'english-writing', name: 'English Writing', grade: '4' },
      { subjectId: 'science', name: 'Science', grade: '4' },
      { subjectId: 'history-social-science', name: 'History-Social Science', grade: '4' },
    ]);
  });

  it('adds Math Adventures, last, in the grades the legacy curriculum had it', () => {
    expect(classesFor(inventory, student('1', 'early')).map((item) => item.name)).toEqual([
      ...CORE,
      'Math Adventures',
    ]);
  });

  it.each(['TK', 'K', '8'] as const)('covers grade %s with the same five subjects', (grade) => {
    const band = grade === '8' ? 'senior' : 'early';
    const classes = classesFor(inventory, student(grade, band));
    expect(classes.map((item) => item.name)).toEqual(CORE);
    expect(classes.every((item) => item.grade === grade)).toBe(true);
  });

  it('never shows an authored subject beside the catalogue subject that covers it', () => {
    for (const grade of ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'] as const) {
      const ids = classesFor(inventory, student(grade, 'middle')).map((item) => item.subjectId);
      expect(ids).not.toContain('math');
      expect(ids).not.toContain('reading');
      expect(ids).not.toContain('writing');
    }
  });
});
