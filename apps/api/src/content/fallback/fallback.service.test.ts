import { describe, expect, it } from 'vitest';

import { createFallbackService } from '@/content';
import { createInventoryService } from '@/curriculum';
import { createQualityGate } from '@/quality';

describe('verified fallback bank', () => {
  it('boots with one gated item for every inventory skill', () => {
    const inventory = createInventoryService();
    const service = createFallbackService({
      inventory,
      gate: createQualityGate(() => ({ safe: true, categories: [] })),
    });

    for (const skill of inventory.listSkills()) {
      expect(service.get(skill.code)).toMatchObject({
        definition: { skillCode: skill.code },
        pass: { verdict: 'pass' },
      });
    }
  });
});
