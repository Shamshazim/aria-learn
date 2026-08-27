import type { Band, Expects } from '@aria/shared';

export type Endpointing = Readonly<{ minDelaySeconds: number; maxDelaySeconds: number }>;

const BY_BAND: Readonly<Record<Band, Endpointing>> = {
  early: { minDelaySeconds: 0.25, maxDelaySeconds: 2.5 },
  middle: { minDelaySeconds: 0.3, maxDelaySeconds: 2 },
  senior: { minDelaySeconds: 0.4, maxDelaySeconds: 1.5 },
};

export function endpointingFor(
  input: Readonly<{
    band: Band;
    expects: Expects;
    oralReading: boolean;
  }>,
): Endpointing | null {
  if (input.oralReading) return null;
  if (input.expects === 'choice' || input.expects === 'number') {
    return { minDelaySeconds: 0.2, maxDelaySeconds: 1 };
  }
  return BY_BAND[input.band];
}

export function silenceWindowSeconds(band: Band, oralReading: boolean): number {
  if (oralReading) return 4;
  return { early: 6, middle: 8, senior: 10 }[band];
}
