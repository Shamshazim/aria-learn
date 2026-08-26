import type { Skill } from '@aria/shared';

export type InvalidGraphFixture = Readonly<{
  name: string;
  skills: readonly Skill[];
  expectedCodes: readonly string[];
}>;

export const INVALID_GRAPH_FIXTURES: readonly InvalidGraphFixture[] = [
  {
    name: 'duplicate code',
    skills: [
      {
        id: 'skill-duplicate-a',
        subject: 'arithmetic',
        strand: 'fixture',
        code: 'DUPLICATE.CODE',
        name: 'First duplicate',
        band: 'early',
        prerequisites: [],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
      {
        id: 'skill-duplicate-b',
        subject: 'arithmetic',
        strand: 'fixture',
        code: 'DUPLICATE.CODE',
        name: 'Second duplicate',
        band: 'early',
        prerequisites: [],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
    ],
    expectedCodes: ['DUPLICATE.CODE'],
  },
  {
    name: 'dangling prerequisite',
    skills: [
      {
        id: 'skill-dangling',
        subject: 'reading',
        strand: 'fixture',
        code: 'DANGLING.DEPENDENT',
        name: 'Dangling dependent',
        band: 'middle',
        prerequisites: ['MISSING.PREREQUISITE'],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
    ],
    expectedCodes: ['DANGLING.DEPENDENT', 'MISSING.PREREQUISITE'],
  },
  {
    name: 'band regression',
    skills: [
      {
        id: 'skill-senior-prerequisite',
        subject: 'writing',
        strand: 'fixture',
        code: 'SENIOR.PREREQUISITE',
        name: 'Senior prerequisite',
        band: 'senior',
        prerequisites: [],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
      {
        id: 'skill-early-dependent',
        subject: 'writing',
        strand: 'fixture',
        code: 'EARLY.DEPENDENT',
        name: 'Early dependent',
        band: 'early',
        prerequisites: ['SENIOR.PREREQUISITE'],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
    ],
    expectedCodes: ['EARLY.DEPENDENT', 'SENIOR.PREREQUISITE'],
  },
  {
    name: 'cycle',
    skills: [
      {
        id: 'skill-cycle-a',
        subject: 'reading',
        strand: 'fixture',
        code: 'CYCLE.A',
        name: 'Cycle A',
        band: 'early',
        prerequisites: ['CYCLE.B'],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
      {
        id: 'skill-cycle-b',
        subject: 'reading',
        strand: 'fixture',
        code: 'CYCLE.B',
        name: 'Cycle B',
        band: 'early',
        prerequisites: ['CYCLE.A'],
        lessonRef: 'lesson-fixture',
        visualKinds: [],
      },
    ],
    expectedCodes: ['CYCLE.A', 'CYCLE.B'],
  },
];
