import { describe, expect, it } from 'vitest';

import { endpointingFor, silenceWindowSeconds } from './endpointing';

describe('child endpointing policy', () => {
  it.each([
    ['early', 0.25, 2.5],
    ['middle', 0.3, 2],
    ['senior', 0.4, 1.5],
  ] as const)('keeps the %s band pause allowance', (band, min, max) => {
    expect(endpointingFor({ band, expects: 'speech', oralReading: false })).toEqual({
      minDelaySeconds: min,
      maxDelaySeconds: max,
    });
  });

  it('uses a short endpoint for one-word answers and passage-driven reading', () => {
    expect(endpointingFor({ band: 'early', expects: 'choice', oralReading: false })).toEqual({
      minDelaySeconds: 0.2,
      maxDelaySeconds: 1,
    });
    expect(endpointingFor({ band: 'early', expects: 'speech', oralReading: true })).toBeNull();
    expect(silenceWindowSeconds('early', true)).toBe(4);
  });
});
