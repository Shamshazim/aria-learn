import { describe, expect, it } from 'vitest';

import { createInventoryService } from '@/curriculum';
import { loadLessonNotes } from '@/curriculum/lessons';
import { LessonNoteError, parseLessonNote } from '@/curriculum/lessons/lesson.parse';

const NOTE = `---
id: lesson-fixture
skill: FIXTURE.CODE
review: pending
---

## What it is
Something a child can be taught in one sitting, described plainly.

## The one idea
The single thing that has to land before anything else makes sense here.

## Common stumbles
- The first way it goes wrong for a child.
- The second way it goes wrong for a child.
- The third way it goes wrong for a child.

## Two concrete models
- A picture the child can look at.
- A different picture the child can look at.

## Worked example
Here is the whole thing done once, slowly, with the numbers said out loud.

## Language to use
- plain words
- more plain words

## Language to avoid
- polysyllabic terminology
- jargon
`;

describe('lesson notes', () => {
  it('parses every section of an authored note', () => {
    expect(parseLessonNote(NOTE, 'FIXTURE.CODE.md')).toMatchObject({
      id: 'lesson-fixture',
      skillCode: 'FIXTURE.CODE',
      review: { status: 'pending' },
      stumbles: [
        'The first way it goes wrong for a child.',
        'The second way it goes wrong for a child.',
        'The third way it goes wrong for a child.',
      ],
      models: ['A picture the child can look at.', 'A different picture the child can look at.'],
      avoidLanguage: ['polysyllabic terminology', 'jargon'],
    });
  });

  it('refuses a note with only one model rather than teaching from half of one', () => {
    const thin = NOTE.replace('- A different picture the child can look at.\n', '');
    expect(() => parseLessonNote(thin, 'thin.md')).toThrow(LessonNoteError);
  });

  it('refuses a note with no front matter', () => {
    expect(() => parseLessonNote(NOTE.slice(NOTE.indexOf('##')), 'bare.md')).toThrow(
      LessonNoteError,
    );
  });

  it('has a note for every authored skill in the inventory', () => {
    const notes = loadLessonNotes();
    for (const skill of createInventoryService({ lessons: notes }).listAuthoredSkills()) {
      expect(notes.get(skill.code), skill.code).toBeDefined();
    }
  });

  it('fails the inventory when a skill points at the wrong note', () => {
    const notes = new Map(loadLessonNotes());
    const first = [...notes.values()][0];
    if (first === undefined) throw new Error('no notes loaded');
    notes.set(first.skillCode, { ...first, id: 'lesson-somewhere-else' });
    expect(() => createInventoryService({ lessons: notes })).toThrow(/points at/u);
  });

  it('reports the review backlog rather than hiding it', () => {
    const review = createInventoryService().lessonReview();

    expect(review.total).toBe(16);
    // Release-blocking and honest: no teacher has read these yet, and the report says so.
    expect(review.approved).toBe(0);
    expect(review.pending).toHaveLength(16);
  });
});
