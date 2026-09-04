import { describe, expect, it } from 'vitest';

import { createInventoryService } from '@/curriculum';
import { STRATEGY_CLAIMS } from '@/quality';
import { strategiesFor } from '@/services/tutor/strategy-evidence';
import { SKILL_STRATEGIES } from '@/services/tutor/strategy-evidence.data';

const CLAIM_IDS = new Set(STRATEGY_CLAIMS.map((claim) => claim.id));

/**
 * P2H-11: the table praise is grounded in, checked against the two things it refers to.
 *
 * A skill code that no longer exists, or a claim id the vocabulary dropped, would both fail
 * silently: the lookup returns nothing and the praise quietly stops being specific. Neither is
 * visible from a passing session, so it is asserted here instead.
 */
describe('the strategy evidence table', () => {
  const inventory = createInventoryService();

  it('names every authored skill in the inventory and no others', () => {
    expect(Object.keys(SKILL_STRATEGIES).sort()).toEqual(
      inventory
        .listAuthoredSkills()
        .map((skill) => skill.code)
        .sort(),
    );
  });

  it('only vouches for strategies the claim vocabulary knows', () => {
    for (const [code, strategies] of Object.entries(SKILL_STRATEGIES)) {
      for (const id of strategies) expect(CLAIM_IDS, `${code}: ${id}`).toContain(id);
    }
  });

  it('vouches for nothing at all when the answer was wrong', () => {
    expect(strategiesFor('ADD.REGROUP.2D', false)).toEqual([]);
    expect(strategiesFor('ADD.REGROUP.2D', true)).toContain('regrouped');
  });

  /** A recalled fact proves no method: the child may have counted, made a ten, or remembered. */
  it('vouches for nothing on a skill whose items prove no method', () => {
    expect(strategiesFor('ADD.FACT.10', true)).toEqual([]);
    expect(strategiesFor(null, true)).toEqual([]);
  });
});
