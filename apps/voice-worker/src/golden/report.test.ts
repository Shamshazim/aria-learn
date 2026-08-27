import { describe, expect, it } from 'vitest';

import { buildVoiceGoldenReport } from './report';
import { voiceCandidateResultSchema } from './result.schema';

describe('voice golden report', () => {
  it('does not permit synthetic smoke data to choose a provider', () => {
    const report = buildVoiceGoldenReport(
      voiceCandidateResultSchema.parse({
        candidate: 'candidate-a',
        generatedAt: '2026-08-24T00:00:00.000Z',
        observations: [observation('synthetic')],
      }),
    );

    expect(report.humanLabelled).toBe(0);
    expect(report.transcriptAccuracy).toBeNull();
    expect(report.eligibleForProviderDecision).toBe(false);
  });

  it('reports confidence intervals and blocking defects from human-labelled runs', () => {
    const report = buildVoiceGoldenReport(
      voiceCandidateResultSchema.parse({
        candidate: 'candidate-a',
        generatedAt: '2026-08-24T00:00:00.000Z',
        observations: [
          observation('human_labelled'),
          { ...observation('human_labelled'), scenarioId: 'unsafe', falseTeaching: true },
        ],
      }),
    );

    expect(report.transcriptAccuracy).toMatchObject({ passed: 2, total: 2, rate: 1 });
    expect(report.falseTeachingCount).toBe(1);
    expect(report.eligibleForProviderDecision).toBe(false);
  });

  it('reports what the bridges did, per bucket, and how often one repeated', () => {
    const report = buildVoiceGoldenReport(
      voiceCandidateResultSchema.parse({
        candidate: 'candidate-a',
        generatedAt: '2026-08-24T00:00:00.000Z',
        observations: [
          { ...observation('synthetic'), bridgeBucket: 'thinking' },
          {
            ...observation('synthetic'),
            scenarioId: 'again',
            bridgeBucket: 'thinking',
            bridgeRepeat: true,
          },
          { ...observation('synthetic'), scenarioId: 'quiet' },
        ],
      }),
    );

    expect(report.bridgesPlayed).toBe(2);
    expect(report.bridgeRepeats).toBe(1);
    expect(report.bridgesByBucket).toEqual({ thinking: 2 });
  });
});

function observation(provenance: 'human_labelled' | 'synthetic') {
  return {
    scenarioId: 'short-answer',
    provenance,
    transcriptCorrect: true,
    endOfTurnCorrect: true,
    interruptionSilenceMs: 180,
    firstAudioMs: 600,
    endToEndMs: 900,
    falseTeaching: false,
    lowConfidenceDurableUpdate: false,
    spokenTeachingApproved: true,
    bridgeBucket: null,
    bridgeRepeat: false,
    estimatedCostUsd: 0.01,
  };
}
