import { describe, expect, it } from 'vitest';

import { subjectSlug, topicCode } from '@/curriculum/catalogue/catalogue.codes';
import { loadCatalogue } from '@/curriculum/catalogue/catalogue.loader';

describe('the legacy curriculum catalogue', () => {
  const catalogue = loadCatalogue();

  it('carries every legacy subject across with its grades', () => {
    expect(catalogue.subjects.map((subject) => [subject.id, subject.name, subject.grades])).toEqual(
      [
        ['english-writing', 'English Writing', ['1', '2', '3', '4', '5', '6', '7', '8']],
        ['mathematics', 'Mathematics', ['1', '2', '3', '4', '5', '6', '7', '8']],
        ['math-adventures', 'Math Adventures', ['1', '2', '3']],
        ['science', 'Science', ['4']],
      ],
    );
  });

  it('carries every topic across: 392 from the JSON files and 2 from the Science migration', () => {
    const bySubject = new Map<string, number>();
    for (const skill of catalogue.skills) {
      bySubject.set(skill.subject, (bySubject.get(skill.subject) ?? 0) + 1);
    }
    expect(Object.fromEntries(bySubject)).toEqual({
      'english-writing': 156,
      'mathematics': 209,
      'math-adventures': 27,
      'science': 2,
    });
  });

  it('gives a topic a positional code that fits the skill table and a band from its grade', () => {
    const first = catalogue.skills.find((skill) => skill.code === 'MATH.G1.U01.L01.T01');

    expect(first).toMatchObject({
      id: 'skill-math-g1-u01-l01-t01',
      name: 'Counting to 20',
      subject: 'mathematics',
      grade: '1',
      band: 'early',
      strand: 'Counting and Number Sense',
      unit: 'Counting and Number Sense',
      lesson: 'Counting Numbers',
      prerequisites: [],
      lessonRef: null,
      ordering: 1,
    });
    expect(first?.objectives).toEqual([
      'Count forward to 20 starting at any number',
      'Match a count to a group of objects',
    ]);
    for (const skill of catalogue.skills) expect(skill.code.length).toBeLessThanOrEqual(32);
  });

  it('gates each topic on the one before it in the same lesson, as the legacy app did', () => {
    const second = catalogue.skills.find((skill) => skill.code === 'MATH.G1.U01.L01.T02');
    const nextLesson = catalogue.skills.find((skill) => skill.code === 'MATH.G1.U01.L02.T01');

    expect(second?.prerequisites).toEqual(['MATH.G1.U01.L01.T01']);
    expect(nextLesson?.prerequisites).toEqual([]);
  });

  it('never files a catalogue topic under the checker-proven arithmetic subject', () => {
    expect(catalogue.skills.some((skill) => skill.subject === 'arithmetic')).toBe(false);
  });

  it('slugs a subject the way the legacy seeder did', () => {
    expect(subjectSlug('English Writing')).toBe('english-writing');
    expect(subjectSlug('  Math Adventures! ')).toBe('math-adventures');
    expect(
      topicCode({ subject: 'science', grade: '4', unit: 1, lesson: 1, topic: 2 }),
    ).toBe('SCI.G4.U01.L01.T02');
  });
});
