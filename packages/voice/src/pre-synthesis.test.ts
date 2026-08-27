import { describe, expect, it } from 'vitest';

import { createPreSynthesisTracker } from './pre-synthesis';

describe('speculative speech tracking', () => {
  it('reports generated audio that was invalidated before playback as waste', () => {
    const tracker = createPreSynthesisTracker();
    tracker.generated('next-move', 0.002);
    tracker.generated('next-hint', 0.003);
    tracker.played('next-move');

    expect(tracker.snapshot()).toEqual({
      generated: 2,
      played: 1,
      wasted: 1,
      generatedCostUsd: 0.005,
      wastedCostUsd: 0.003,
    });
  });

  it('rejects invalid cost observations', () => {
    const tracker = createPreSynthesisTracker();
    expect(() => {
      tracker.generated('asset', -1);
    }).toThrow(/non-negative/);
  });
});
