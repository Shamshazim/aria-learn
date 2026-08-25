import { describe, expect, it } from 'vitest';

import { INVALID_GRAPH_FIXTURES } from '@/curriculum/__fixtures__/validation.fixtures';
import { validateSkillGraph } from '@/curriculum/validate';

describe('skill graph validation', () => {
  it.each(INVALID_GRAPH_FIXTURES)('rejects $name and names the offending codes', (fixture) => {
    expect.assertions(fixture.expectedCodes.length);

    try {
      validateSkillGraph(fixture.skills);
    } catch (error) {
      for (const code of fixture.expectedCodes)
        expect(error).toHaveProperty('message', expect.stringContaining(code));
    }
  });
});
