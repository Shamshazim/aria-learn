import { describe, expect, it } from 'vitest';

import { createFirstAudioEstimate } from '@/session/first-audio-estimate';

describe('first audio estimate', () => {
  it('has no opinion until it has watched five turns', () => {
    const estimate = createFirstAudioEstimate();

    for (let turn = 0; turn < 4; turn += 1) {
      estimate.started(turn * 10_000);
      estimate.heard(turn * 10_000 + 700);
    }

    expect(estimate.expectedMs()).toBeNull();
  });

  it('reports the median of the last five turns', () => {
    const estimate = createFirstAudioEstimate();

    for (const [turn, latency] of [900, 300, 700, 500, 1_100].entries()) {
      estimate.started(turn * 10_000);
      estimate.heard(turn * 10_000 + latency);
    }

    expect(estimate.expectedMs()).toBe(700);
  });

  it('counts only the first sentence of a turn, not the rest of the same answer', () => {
    const estimate = createFirstAudioEstimate();

    for (let turn = 0; turn < 5; turn += 1) {
      estimate.started(turn * 10_000);
      estimate.heard(turn * 10_000 + 400);
      // The second and third sentences of the same answer arrive later and mean nothing here.
      estimate.heard(turn * 10_000 + 3_000);
    }

    expect(estimate.expectedMs()).toBe(400);
  });

  it('forgets a turn older than the window', () => {
    const estimate = createFirstAudioEstimate();

    for (const [turn, latency] of [5_000, 100, 100, 100, 100, 100].entries()) {
      estimate.started(turn * 10_000);
      estimate.heard(turn * 10_000 + latency);
    }

    expect(estimate.expectedMs()).toBe(100);
  });
});
