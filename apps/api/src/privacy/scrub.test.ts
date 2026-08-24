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
});
