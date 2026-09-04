import { describe, expect, it } from 'vitest';

import { createS2SMetrics } from '@/session/s2s-metrics';

function harness(sink: ((line: string) => Promise<void>) | null = null) {
  let clock = 1_000;
  let id = 0;
  const metrics = createS2SMetrics({
    provider: 'openai/gpt-realtime',
    now: () => clock,
    nextId: () => `turn-${String(++id)}`,
    sink,
  });
  return { metrics, tick: (ms: number) => (clock += ms) };
}

const detail = { oralReading: false, sttError: false, estimatedCostUsd: 0.01 };

describe('speech-to-speech turn metrics', () => {
  it('times the reply from the moment the vendor said the child stopped', async () => {
    const { metrics, tick } = harness();
    metrics.childStopped();
    tick(420);
    metrics.firstAudio();
    tick(3_000);
    metrics.firstAudio();

    await expect(metrics.closeTurn(detail)).resolves.toMatchObject({
      turnId: 'turn-1',
      firstAudioMs: 420,
      silenceToReplyMs: 420,
      offPlan: false,
      safetyEscapeWords: 0,
      transcriptLagMs: null,
      estimatedCostUsd: 0.01,
    });
  });

  it("records an interruption, the overlap, and how long Aria's audio took to stop", async () => {
    const { metrics, tick } = harness();
    metrics.childStopped();
    tick(300);
    metrics.firstAudio();
    metrics.overlap();
    metrics.interruptionStarted();
    tick(180);
    metrics.interruptionSilent();

    await expect(metrics.closeTurn(detail)).resolves.toMatchObject({
      overlapCount: 1,
      interruptionToSilenceMs: 180,
    });
  });

  it('keeps the worst transcript lag and every escaped word of a turn', async () => {
    const { metrics, tick } = harness();
    metrics.childStopped();
    tick(1);
    metrics.firstAudio();
    metrics.transcriptLag(120);
    metrics.transcriptLag(90);
    metrics.offPlan(3);
    metrics.offPlan(2);

    await expect(metrics.closeTurn(detail)).resolves.toMatchObject({
      transcriptLagMs: 120,
      offPlan: true,
      safetyEscapeWords: 5,
    });
  });

  it("does not count Aria's opening as a reply, and starts each turn clean", async () => {
    const { metrics, tick } = harness();
    metrics.firstAudio();
    await expect(metrics.closeTurn(detail)).resolves.toBeNull();

    metrics.childStopped();
    tick(50);
    metrics.firstAudio();
    await metrics.closeTurn(detail);
    metrics.childStopped();
    tick(70);
    metrics.firstAudio();

    await expect(metrics.closeTurn(detail)).resolves.toMatchObject({
      turnId: 'turn-2',
      firstAudioMs: 70,
      overlapCount: 0,
    });
    expect(metrics.observations()).toHaveLength(2);
  });

  it('writes a provider header once, then one JSONL line per closed turn', async () => {
    const written: string[] = [];
    const { metrics, tick } = harness((line) => {
      written.push(line);
      return Promise.resolve();
    });
    for (const _turn of [1, 2]) {
      metrics.childStopped();
      tick(10);
      metrics.firstAudio();
      await metrics.closeTurn(detail);
    }

    expect(written).toHaveLength(3);
    expect(JSON.parse(written[0] ?? '')).toEqual({ provider: 'openai/gpt-realtime' });
    expect(JSON.parse(written[2] ?? '')).toMatchObject({ turnId: 'turn-2' });
  });

  it('survives a run log that cannot be written', async () => {
    const { metrics, tick } = harness(() => Promise.reject(new Error('disk full')));
    metrics.childStopped();
    tick(10);
    metrics.firstAudio();

    await expect(metrics.closeTurn(detail)).resolves.not.toBeNull();
  });
});
