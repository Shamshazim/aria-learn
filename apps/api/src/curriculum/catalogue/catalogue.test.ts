import { describe, expect, it } from 'vitest';

import { subjectSlug, topicCode } from '@/curriculum/catalogue/catalogue.codes';
import { loadCatalogue } from '@/curriculum/catalogue/catalogue.loader';

describe('the legacy curriculum catalogue', () => {
  const catalogue = loadCatalogue();

  const ALL_GRADES = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];

  it('covers every subject from TK to grade 8, and Math Adventures where the legacy app had it', () => {
    expect(catalogue.subjects.map((subject) => [subject.id, subject.name, subject.grades])).toEqual(
      [
        ['english-writing', 'English Writing', ALL_GRADES],
        ['english-reading', 'English Reading', ALL_GRADES],
        ['history-social-science', 'History-Social Science', ALL_GRADES],
        ['mathematics', 'Mathematics', ALL_GRADES],
        ['math-adventures', 'Math Adventures', ['1', '2', '3']],
        ['science', 'Science', ALL_GRADES],
      ],
    );
  });

  it('carries every legacy topic across and adds the California-aligned ones', () => {
    const bySubject = new Map<string, number>();
    for (const skill of catalogue.skills) {
      bySubject.set(skill.subject, (bySubject.get(skill.subject) ?? 0) + 1);
    }
    expect(Object.fromEntries(bySubject)).toEqual({
      'english-writing': 169,
      'english-reading': 132,
      'history-social-science': 109,
      mathematics: 237,
      'math-adventures': 27,
      science: 117,
    });
    expect(catalogue.skills).toHaveLength(791);
  });

  it('keeps the two legacy Science topics on the codes they had', () => {
    expect(catalogue.skills.find((skill) => skill.code === 'SCI.G4.U01.L01.T01')?.name).toBe(
      'Animal Groups',
    );
    expect(catalogue.skills.find((skill) => skill.code === 'SCI.G4.U01.L01.T02')?.name).toBe(
      'Habitats',
    );
  });

  it('files TK and K topics under their own grades and the early band', () => {
    const tk = catalogue.skills.find((skill) => skill.code === 'MATH.GTK.U01.L01.T01');
    const k = catalogue.skills.find((skill) => skill.code === 'HSS.GK.U01.L01.T01');
    expect(tk).toMatchObject({ grade: 'TK', band: 'early', name: 'Counting to 10' });
    expect(k).toMatchObject({ grade: 'K', band: 'early', subject: 'history-social-science' });
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
    expect(topicCode({ subject: 'science', grade: '4', unit: 1, lesson: 1, topic: 2 })).toBe(
      'SCI.G4.U01.L01.T02',
    );
  });
});
