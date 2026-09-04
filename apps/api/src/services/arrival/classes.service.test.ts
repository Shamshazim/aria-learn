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

describe('the classes a child can open', () => {
  const inventory = createInventoryService();

  it('lists the legacy subjects at the grade, and Reading, for a grade-4 child', () => {
    expect(classesFor(inventory, student('4', 'middle'))).toEqual([
      { subjectId: 'english-writing', name: 'English Writing', grade: '4' },
      { subjectId: 'mathematics', name: 'Mathematics', grade: '4' },
      { subjectId: 'science', name: 'Science', grade: '4' },
    ]);
  });

  it('adds Math Adventures in the grades the legacy curriculum had it', () => {
    expect(classesFor(inventory, student('1', 'early')).map((item) => item.name)).toEqual([
      'English Writing',
      'Mathematics',
      'Math Adventures',
      'Reading',
    ]);
  });

  it('keeps the authored Math and Writing for a grade the legacy curricula never covered', () => {
    expect(classesFor(inventory, student('TK', 'early')).map((item) => item.subjectId)).toEqual([
      'math',
      'reading',
      'writing',
    ]);
  });
});
