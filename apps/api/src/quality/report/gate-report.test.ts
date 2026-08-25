import { describe, expect, it } from 'vitest';

import { buildGateReport, createQualityGate } from '@/quality';
import { VALID_ARITHMETIC_ITEM } from '@/quality/__fixtures__/structural-cases.data';

describe('buildGateReport', () => {
  it('aggregates structured failure reasons by check', () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const report = buildGateReport([
      gate(VALID_ARITHMETIC_ITEM),
      gate({ ...VALID_ARITHMETIC_ITEM, childText: '<b>broken</b>' }),
    ]);

    expect(report).toMatchObject({ passed: 1, failed: 1, failuresByCheck: { structural: 1 } });
  });
});
