import type { RawLearnerContext } from '@/privacy/types';

export type IdentifierFixture = {
  identifier: string;
  raw: RawLearnerContext;
};

export const identifierFixtures: readonly IdentifierFixture[] = [
  {
    identifier: 'Priya Shah',
    raw: {
      identifiers: { fullName: 'Priya Shah' },
      learnerMemory: [
        { category: 'preference', text: 'Priya Shah likes space stories.', modelShareable: true },
      ],
    },
  },
  {
    identifier: 'Jordan Rivera',
    raw: {
      identifiers: {},
      recentEvidence: ['My full name is Jordan Rivera.'],
    },
  },
  {
    identifier: 'Lincoln Elementary School',
    raw: {
      identifiers: {},
      recentEvidence: ['The assignment came from Lincoln Elementary School.'],
    },
  },
  {
    identifier: '1428 Cedar Lane',
    raw: {
      identifiers: {},
      learnerMemory: [
        {
          category: 'context',
          text: 'The learner lives at 1428 Cedar Lane.',
          modelShareable: true,
        },
      ],
    },
  },
  {
    identifier: '12B Main St',
    raw: {
      identifiers: {},
      recentEvidence: ['I live at 12B Main St.'],
    },
  },
  {
    identifier: 'parent@example.com',
    raw: {
      identifiers: {},
      recentEvidence: ['Send the worksheet to parent@example.com.'],
    },
  },
  {
    identifier: '(415) 555-0134',
    raw: {
      identifiers: {},
      recentEvidence: ['Call (415) 555-0134 after the lesson.'],
    },
  },
  {
    identifier: '4155550134',
    raw: {
      identifiers: {},
      recentEvidence: ['The backup number is 4155550134.'],
    },
  },
  {
    identifier: '+44 20 7946 0958',
    raw: {
      identifiers: {},
      recentEvidence: ['The international number is +44 20 7946 0958.'],
    },
  },
  {
    identifier: 'lincoln elementary school',
    raw: {
      identifiers: {},
      recentEvidence: ['The learner attends lincoln elementary school.'],
    },
  },
  {
    identifier: 'January 7, 2017',
    raw: {
      identifiers: {},
      learnerMemory: [
        { category: 'context', text: 'Born on January 7, 2017.', modelShareable: true },
      ],
    },
  },
];
