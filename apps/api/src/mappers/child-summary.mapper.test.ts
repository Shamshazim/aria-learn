import { describe, expect, it } from 'vitest';

import { DEFAULT_STUDENT_SETTINGS } from '@/schemas/student-settings.schema';
import type { Student } from '@/types/student';

import { toChildSummary } from './child-summary.mapper';

const SAM: Student = {
  id: '00000000-0000-4000-8000-000000000001',
  parentId: '00000000-0000-4000-8000-0000000000a1',
  displayName: 'Sam',
  grade: '4',
  band: 'middle',
  settings: { ...DEFAULT_STUDENT_SETTINGS, avatar: 'owl', pronunciation: 'Sahm' },
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
};

describe('toChildSummary', () => {
  it('gives a child screen a first name, a picture and how to sign in', () => {
    expect(toChildSummary(SAM, 'pin')).toEqual({
      id: SAM.id,
      firstName: 'Sam',
      grade: '4',
      band: 'middle',
      avatar: 'owl',
      loginMethod: 'pin',
    });
  });

  /**
   * The whole point of the mapper: a field added to `Student` must not arrive on a child's
   * device by being spread through here. The schema is strict, so it cannot.
   */
  it('carries nothing about the parent, and nothing the child cannot see', () => {
    const summary = JSON.stringify(toChildSummary(SAM, 'family-device'));

    expect(summary).not.toContain(SAM.parentId);
    expect(summary).not.toContain('Sahm');
    expect(summary).not.toContain('createdAt');
  });
});
