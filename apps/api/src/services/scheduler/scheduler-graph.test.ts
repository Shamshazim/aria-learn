import { describe, expect, it } from 'vitest';

import { SkillGraphCycleError } from '@aria/tutor';

import { createInventoryService } from '@/curriculum';
import { INVALID_GRAPH_FIXTURES } from '@/curriculum/__fixtures__/validation.fixtures';

import { schedulerGraph } from './scheduler-graph';

describe('the scheduler graph over the inventory', () => {
  it('refuses the cycle fixture at startup, naming the cycle', () => {
    const cycle = INVALID_GRAPH_FIXTURES.find((fixture) => fixture.name === 'cycle');
    expect(cycle).toBeDefined();
    expect(() => schedulerGraph(cycle?.skills ?? [])).toThrow(SkillGraphCycleError);
    try {
      schedulerGraph(cycle?.skills ?? []);
    } catch (error) {
      for (const code of cycle?.expectedCodes ?? []) {
        expect(error).toHaveProperty('message', expect.stringContaining(code));
      }
    }
  });

  it('builds over the whole shipped inventory and knows a facts skill by its code', () => {
    const graph = schedulerGraph(createInventoryService().listSkills());
    expect(graph.get('ADD.FACT.10')?.facts).toBe(true);
    expect(graph.get('ADD.REGROUP.2D')?.facts).toBe(false);
    expect(graph.prerequisitesOf('ADD.REGROUP.2D')).toContain('ADD.FACT.10');
  });
});
