import { describe, expect, it, vi } from 'vitest';

import { createGateObserver, GATE_REJECTIONS_TOTAL } from '@/observability/gate-metrics';
import { createMetrics } from '@/observability/metrics';
import { createQualityGate } from '@/quality';
import type { GateInput } from '@/quality/gate.types';

const SAFE = () => ({ safe: true, categories: [] });

const TOO_LONG: GateInput = {
  id: 'too-long',
  kind: 'text',
  band: 'early',
  childText:
    'Interpret the sophisticated relationship because the argument needs evidence and support.',
  factual: false,
  grounding: 'reviewed-bank',
};

function observed() {
  const metrics = createMetrics();
  const logger = { warn: vi.fn() };
  return {
    metrics,
    logger,
    gate: createQualityGate(SAFE, createGateObserver({ metrics, logger })),
  };
}

describe('gate rejection observability', () => {
  it('emits one structured log and one counter increment per rejection', () => {
    const { gate, logger, metrics } = observed();

    gate(TOO_LONG);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'gate_rejection',
        contentId: 'too-long',
        band: 'early',
        check: 'level',
        code: 'readability',
        codes: ['readability'],
      }),
      expect.any(String),
    );
    expect(metrics.snapshot().counters).toEqual({
      [`${GATE_REJECTIONS_TOTAL}{band=early,check=level,code=readability}`]: 1,
    });
  });

  it('never reports a passing item', () => {
    const { gate, logger, metrics } = observed();

    gate({ ...TOO_LONG, id: 'fine', childText: 'Nice work. Try the next one.' });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(metrics.snapshot().counters).toEqual({});
  });

  it('counts each rejection separately so a repeated failure is visible', () => {
    const { gate, metrics } = observed();

    gate(TOO_LONG);
    gate(TOO_LONG);

    expect(
      metrics.snapshot().counters[
        `${GATE_REJECTIONS_TOTAL}{band=early,check=level,code=readability}`
      ],
    ).toBe(2);
  });

  it('refuses decodable text rather than scoring its readability', () => {
    const { gate } = observed();

    const verdict = gate({
      id: 'cvc-1',
      kind: 'decodable',
      pattern: 'cvc',
      band: 'early',
      childText: 'The cat sat.',
      factual: false,
      grounding: 'reviewed-bank',
    });

    expect(verdict).toMatchObject({
      verdict: 'fail',
      reasons: [{ check: 'level', code: 'decodable_unsupported' }],
    });
  });
});
