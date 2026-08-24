import { describe, expect, it } from 'vitest';

import { scrubLearnerContext } from '@/privacy/scrub';

describe('privacy context collection bounds', () => {
  it('rejects an oversized evidence list before scrubbing it', () => {
    expect(() =>
      scrubLearnerContext(
        {
          identifiers: { fullName: 'Priya Shah' },
          recentEvidence: Array.from({ length: 33 }, () => 'Answered 4.'),
        },
        { pseudonym: 'omit' },
      ),
    ).toThrow('Recent evidence exceeds the privacy limit.');
  });

  it('rejects an oversized learner-memory list before scrubbing it', () => {
    expect(() =>
      scrubLearnerContext(
        {
          identifiers: { fullName: 'Priya Shah' },
          learnerMemory: Array.from({ length: 33 }, () => ({
            category: 'preference',
            modelShareable: true,
            text: 'Likes astronomy.',
          })),
        },
        { pseudonym: 'omit' },
      ),
    ).toThrow('Learner memory exceeds the privacy limit.');
  });
});

describe('privacy context string bounds', () => {
  it('rejects an oversized known identifier before compiling redaction rules', () => {
    expect(() =>
      scrubLearnerContext(
        {
          identifiers: { fullName: 'P'.repeat(129) },
        },
        { pseudonym: 'omit' },
      ),
    ).toThrow('Learner identifier exceeds the privacy limit.');
  });

  it('rejects oversized learner-context text before redaction', () => {
    expect(() =>
      scrubLearnerContext(
        {
          identifiers: { fullName: 'Priya Shah' },
          recentEvidence: ['A'.repeat(2001)],
        },
        { pseudonym: 'omit' },
      ),
    ).toThrow('Learner context text exceeds the privacy limit.');
  });

  it('rejects an oversized learner-memory category', () => {
    expect(() =>
      scrubLearnerContext(
        {
          identifiers: { fullName: 'Priya Shah' },
          learnerMemory: [
            { category: 'C'.repeat(65), modelShareable: true, text: 'Likes astronomy.' },
          ],
        },
        { pseudonym: 'omit' },
      ),
    ).toThrow('Learner memory category exceeds the privacy limit.');
  });
});
