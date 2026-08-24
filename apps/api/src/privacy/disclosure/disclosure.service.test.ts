import { describe, expect, it } from 'vitest';

import { createDisclosureService } from '@/privacy/disclosure/disclosure.service';
import { scrubLearnerContext } from '@/privacy/scrub';
import type { LearnerContextDisclosure } from '@/privacy/types';

describe('disclosure service', () => {
  it('records only shared categories against the generation log row', async () => {
    const saved: LearnerContextDisclosure[] = [];
    const service = createDisclosureService({
      writer: {
        save: (record) => {
          saved.push(record);
          return Promise.resolve();
        },
      },
    });
    const context = scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        gradeBand: '3-5',
        learnerMemory: [
          { category: 'preference', text: 'Priya Shah likes astronomy.', modelShareable: true },
        ],
      },
      { pseudonym: 'omit' },
    );

    await service.recordSharedContext({ generationLogId: 'generation-1', context });

    expect(saved).toEqual([
      {
        generationLogId: 'generation-1',
        categories: ['grade_band', 'learner_memory'],
      },
    ]);
    expect(JSON.stringify(saved)).not.toMatch(/Priya|astronomy/);
  });
});
