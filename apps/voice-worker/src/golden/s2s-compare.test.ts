import { describe, expect, it } from 'vitest';

import { compareArms, pipelineArmFromGolden, summariseArm } from './s2s-compare';

import type { S2SArmResult, S2SObservation } from './s2s-result.schema';

function turn(overrides: Partial<S2SObservation> = {}): S2SObservation {
  return {
    turnId: 't',
    firstAudioMs: 600,
    silenceToReplyMs: 600,
    interruptionToSilenceMs: 200,
    overlapCount: 0,
    offPlan: false,
    safetyEscapeWords: 0,
    transcriptLagMs: 150,
    sttError: false,
    endOfTurnError: false,
    oralReading: false,
    estimatedCostUsd: 0.01,
    rubricScore: null,
    ...overrides,
  };
}

function arm(kind: 'pipeline' | 's2s', turns: S2SObservation[]): S2SArmResult {
  return {
    arm: kind,
    provider: kind,
    generatedAt: '2026-08-28T00:00:00.000Z',
    observations: turns,
  };
}

/** Twenty distinct rubric scores stand in for twenty scored sessions. */
function scored(kind: 'pipeline' | 's2s', base: Partial<S2SObservation>): S2SArmResult {
  return arm(
    kind,
    Array.from({ length: 20 }, (_item, index) =>
      turn({ ...base, rubricScore: 0.9 - index / 1_000 }),
    ),
  );
}

const now = (): Date => new Date('2026-08-28T12:00:00.000Z');

describe('comparing the two arms', () => {
  it('summarises an arm with the p95s and Wilson intervals the memo quotes', () => {
    const summary = summariseArm(
      arm('s2s', [
        turn(),
        turn({ offPlan: true, safetyEscapeWords: 4 }),
        turn({ transcriptLagMs: null }),
      ]),
    );

    expect(summary.turns).toBe(3);
    expect(summary.offPlanRate.passed).toBe(1);
    expect(summary.offPlanRate.confidence95.upper).toBeGreaterThan(summary.offPlanRate.rate);
    expect(summary.safetyEscapeWords).toBe(4);
    expect(summary.transcriptLagP95Ms).toBe(150);
    expect(summary.rubricSessions).toBe(0);
    expect(summary.rubricMean).toBeNull();
  });

  it('is insufficient evidence until twenty rubric sessions exist on each arm', () => {
    const result = compareArms(arm('pipeline', [turn()]), arm('s2s', [turn()]), now);

    expect(result.recommendation).toBe('insufficient_evidence');
    expect(result.reasons).toContainEqual(expect.stringContaining('rubric sessions 0/0'));
  });

  /** The ticket's rule: > 2% off-plan fails regardless of latency. */
  it('fails s2s on off-plan rate however fast it was', () => {
    const s2s = scored('s2s', { silenceToReplyMs: 100 });
    const bad = { ...s2s, observations: [...s2s.observations, turn({ offPlan: true })] };

    const result = compareArms(scored('pipeline', {}), bad, now);

    expect(result.offPlanFails).toBe(true);
    expect(result.recommendation).toBe('pipeline');
  });

  it('fails s2s when the transcript lags too far for the tap to cut in time', () => {
    const result = compareArms(
      scored('pipeline', {}),
      scored('s2s', { transcriptLagMs: 450 }),
      now,
    );

    expect(result.transcriptLagFails).toBe(true);
    expect(result.recommendation).toBe('pipeline');
    expect(result.reasons).toContainEqual(expect.stringContaining('450 ms exceeds 300 ms'));
  });

  it('treats an unmeasured lag as a failure, never as zero', () => {
    const result = compareArms(
      scored('pipeline', {}),
      scored('s2s', { transcriptLagMs: null }),
      now,
    );

    expect(result.transcriptLagFails).toBe(true);
    expect(result.reasons).toContain('transcript lag was not measured');
  });

  it('recommends hybrid, never full s2s, when s2s is faster and as warm', () => {
    const result = compareArms(
      scored('pipeline', { silenceToReplyMs: 900 }),
      scored('s2s', { silenceToReplyMs: 400 }),
      now,
    );

    expect(result.recommendation).toBe('hybrid');
    expect(result.generatedAt).toBe('2026-08-28T12:00:00.000Z');
  });

  it('keeps the pipeline when s2s buys no latency', () => {
    const result = compareArms(
      scored('pipeline', { silenceToReplyMs: 400 }),
      scored('s2s', {}),
      now,
    );

    expect(result.recommendation).toBe('pipeline');
  });

  it('notes a cost above three times the pipeline without deciding on it', () => {
    const result = compareArms(
      scored('pipeline', { silenceToReplyMs: 900, estimatedCostUsd: 0.01 }),
      scored('s2s', { estimatedCostUsd: 0.05 }),
      now,
    );

    expect(result.costRatio).toBeCloseTo(5);
    expect(result.costRatioNoted).toBe(true);
    expect(result.recommendation).toBe('hybrid');
  });

  it('reports oral-reading turns that reached the s2s arm instead of hiding them', () => {
    const result = compareArms(scored('pipeline', {}), scored('s2s', { oralReading: true }), now);

    expect(result.reasons).toContainEqual(expect.stringContaining('oral-reading turns'));
  });

  it('refuses arms in the wrong order', () => {
    expect(() => compareArms(arm('s2s', [turn()]), arm('pipeline', [turn()]), now)).toThrow();
  });

  it('reads a voice:golden result as the pipeline arm', () => {
    const converted = pipelineArmFromGolden({
      candidate: 'assemblyai+elevenlabs',
      generatedAt: '2026-08-28T00:00:00.000Z',
      observations: [
        {
          scenarioId: 's1',
          provenance: 'human_labelled',
          transcriptCorrect: false,
          endOfTurnCorrect: true,
          interruptionSilenceMs: 210,
          firstAudioMs: 700,
          endToEndMs: 1_100,
          falseTeaching: false,
          lowConfidenceDurableUpdate: false,
          spokenTeachingApproved: true,
          bridgeBucket: null,
          bridgeRepeat: false,
          estimatedCostUsd: 0.02,
        },
      ],
    });

    expect(converted.arm).toBe('pipeline');
    expect(converted.observations[0]).toMatchObject({
      turnId: 's1',
      silenceToReplyMs: 1_100,
      sttError: true,
      endOfTurnError: false,
      transcriptLagMs: null,
      offPlan: false,
    });
  });
});
