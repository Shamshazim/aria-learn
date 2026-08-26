import { describe, expect, it } from 'vitest';

import { VISUAL_KINDS } from '@aria/shared';

import { buildVisual, createInventoryService, firstVisualFor, visualsFor } from '@/curriculum';
import type { ArithmeticProblem } from '@/quality/arithmetic';

const REGROUP: ArithmeticProblem = {
  skillCode: 'ADD.REGROUP.2D',
  kind: 'addition',
  left: '48',
  right: '37',
};

describe('SHOW payloads', () => {
  it('builds every declared visual kind', () => {
    for (const kind of VISUAL_KINDS) {
      expect(buildVisual({ kind, caption: 'A picture of it.', problem: null })).toMatchObject({
        type: 'visual',
        visual: kind,
        alt: 'A picture of it.',
      });
    }
  });

  it('draws the open item rather than a stock picture', () => {
    const blocks = buildVisual({
      kind: 'place-value-blocks',
      caption: 'Blocks.',
      problem: REGROUP,
    });

    expect(blocks.params).toEqual({
      groups: [
        { tens: 4, ones: 8 },
        { tens: 3, ones: 7 },
      ],
    });
  });

  it('falls back to a sensible default when there is no item yet', () => {
    expect(
      buildVisual({ kind: 'ten-frame', caption: 'A ten-frame.', problem: null }).params,
    ).toEqual({ total: 10, filled: 0 });
  });

  it('gives every maths skill at least one visual and reading skills none', () => {
    const inventory = createInventoryService();
    for (const skill of inventory.listSkills()) {
      const kinds = visualsFor(skill);
      if (skill.subject === 'arithmetic') expect(kinds.length, skill.code).toBeGreaterThan(0);
      else expect(kinds, skill.code).toEqual([]);
    }
  });

  it('has nothing to reach for when the skill declares no visual', () => {
    expect(firstVisualFor(createInventoryService().getSkill('PA.RHYME'))).toBeNull();
    expect(firstVisualFor(null)).toBeNull();
  });
});
