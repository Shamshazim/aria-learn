import { describe, expect, it } from 'vitest';

import { toVoiceMetric } from './metrics';

describe('LiveKit voice metrics adapter', () => {
  it('keeps named latency spans and removes provider request metadata', () => {
    expect(
      toVoiceMetric({
        type: 'tts_metrics',
        label: 'tts',
        requestId: 'vendor-request-id',
        timestamp: 1,
        ttfbMs: 90,
        durationMs: 300,
        audioDurationMs: 800,
        cancelled: false,
        charactersCount: 20,
        streamed: true,
      }),
    ).toEqual({ kind: 'tts', ttfbMs: 90, durationMs: 300, cancelled: false });
  });

  it('ignores metric families that are not Phase 2 voice spans', () => {
    expect(
      toVoiceMetric({
        type: 'vad_metrics',
        label: 'vad',
        timestamp: 1,
        idleTimeMs: 0,
        inferenceDurationTotalMs: 10,
        inferenceCount: 2,
      }),
    ).toBeNull();
  });
});
