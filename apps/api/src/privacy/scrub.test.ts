import { describe, expect, it } from 'vitest';

import { identifierFixtures } from '@/privacy/__fixtures__/identifier.fixtures';
import { scrubLearnerContext } from '@/privacy/scrub';

describe('scrubLearnerContext', () => {
  it.each(identifierFixtures)('removes the $identifier identifier', ({ identifier, raw }) => {
    const scrubbed = scrubLearnerContext(raw, { pseudonym: 'omit' });

    expect(JSON.stringify(scrubbed.value)).not.toContain(identifier);
  });

  it('omits facts excluded by the parent', () => {
    const scrubbed = scrubLearnerContext(
      {
        identifiers: {},
        learnerMemory: [
          { category: 'preference', text: 'Likes astronomy.', modelShareable: true },
          { category: 'family', text: 'Private family fact.', modelShareable: false },
        ],
      },
      { pseudonym: 'omit' },
    );

    expect(scrubbed.value.learnerMemory).toEqual([
      { category: 'preference', text: 'Likes astronomy.' },
    ]);
    expect(JSON.stringify(scrubbed.value)).not.toContain('Private family fact');
  });

  it('preserves title-cased educational context', () => {
    const scrubbed = scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        skill: 'Common Core Fractions',
        recentEvidence: ['Used The Pythagorean Theorem correctly.'],
        learnerMemory: [
          {
            category: 'preference',
            modelShareable: true,
            text: 'Enjoys Ancient Rome and Ancient Greece.',
          },
        ],
      },
      { pseudonym: 'omit' },
    );

    expect(scrubbed.value).toMatchObject({
      skill: 'Common Core Fractions',
      recentEvidence: ['Used The Pythagorean Theorem correctly.'],
      learnerMemory: [{ category: 'preference', text: 'Enjoys Ancient Rome and Ancient Greece.' }],
    });
  });
});
