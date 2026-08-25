import { describe, expect, it } from 'vitest';

import {
  LEVEL_CORPUS,
  type LevelCase,
} from '@/quality/checks/level/__fixtures__/level-corpus.fixture';
import { checkLevel } from '@/quality/checks/level.check';
import type { GateInput } from '@/quality/gate.types';

const PASS_RATE_BAR = 0.98;

function gateInput(entry: LevelCase): GateInput {
  return {
    id: entry.name,
    kind: 'text',
    band: entry.band,
    childText: entry.text,
    factual: false,
    grounding: 'reviewed-bank',
  };
}

describe('readability gate regression corpus', () => {
  const shouldPass = LEVEL_CORPUS.filter((entry) => entry.expect === 'pass');
  const shouldFail = LEVEL_CORPUS.filter((entry) => entry.expect === 'fail');

  it('lets at least 98% of real tutor sentences through', () => {
    const rejected = shouldPass.filter((entry) => !checkLevel(gateInput(entry)).passed);
    const rate = (shouldPass.length - rejected.length) / shouldPass.length;

    expect(
      rate,
      `rejected: ${rejected.map((entry) => entry.name).join(', ')}`,
    ).toBeGreaterThanOrEqual(PASS_RATE_BAR);
  });

  it.each(shouldFail)('still rejects $name with $code', (entry) => {
    const result = checkLevel(gateInput(entry));

    expect(result.passed).toBe(false);
    expect(result.reasons.map((reason) => reason.code)).toContain(entry.code);
  });
});
