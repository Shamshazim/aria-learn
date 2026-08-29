import { proportion, type Proportion } from '@aria/voice';

import type { VoiceCandidateResult } from './result.schema';
import type { S2SArm, S2SArmResult, S2SObservation } from './s2s-result.schema';

/**
 * P2H-15: the two arms side by side, and the rules the ticket wrote down applied to them.
 *
 * The rules are fixed here rather than in the memo so the memo can only report what this
 * function said: off-plan above 2% fails regardless of latency, transcript lag above 300 ms
 * means the safety tap cannot cut in time and is a no-go on its own, and cost above 3× the
 * pipeline is noted against P7-04 without deciding anything. Twenty rubric-scored sessions per
 * arm are required before a recommendation is anything other than "insufficient evidence".
 */
export const OFF_PLAN_FAIL_RATE = 0.02;
export const TRANSCRIPT_LAG_FAIL_MS = 300;
export const COST_RATIO_NOTE = 3;
export const RUBRIC_SESSIONS_REQUIRED = 20;

export type ArmSummary = Readonly<{
  arm: S2SArm;
  provider: string;
  turns: number;
  oralReadingTurns: number;
  firstAudioP95Ms: number;
  silenceToReplyP95Ms: number;
  interruptionToSilenceP95Ms: number | null;
  overlapsPerTurn: number;
  offPlanRate: Proportion;
  safetyEscapeWords: number;
  transcriptLagP95Ms: number | null;
  sttErrorRate: Proportion;
  endOfTurnErrorRate: Proportion;
  costPerTurnUsd: number;
  rubricSessions: number;
  rubricMean: number | null;
}>;

export type Recommendation = 'pipeline' | 'hybrid' | 'insufficient_evidence';

export type S2SComparison = Readonly<{
  generatedAt: string;
  pipeline: ArmSummary;
  s2s: ArmSummary;
  offPlanFails: boolean;
  transcriptLagFails: boolean;
  costRatio: number | null;
  costRatioNoted: boolean;
  rubricSufficient: boolean;
  /** Oral reading is never on the S2S arm, so the best S2S can win is hybrid. */
  recommendation: Recommendation;
  reasons: readonly string[];
}>;

export function summariseArm(result: S2SArmResult): ArmSummary {
  const all = result.observations;
  const rubric = uniqueScores(all);
  return {
    arm: result.arm,
    provider: result.provider,
    turns: all.length,
    oralReadingTurns: count(all, (item) => item.oralReading),
    firstAudioP95Ms: percentile(all.map((item) => item.firstAudioMs)),
    silenceToReplyP95Ms: percentile(all.map((item) => item.silenceToReplyMs)),
    interruptionToSilenceP95Ms: optionalPercentile(all.map((item) => item.interruptionToSilenceMs)),
    overlapsPerTurn: sum(all.map((item) => item.overlapCount)) / all.length,
    offPlanRate: proportion(
      count(all, (item) => item.offPlan),
      all.length,
    ),
    safetyEscapeWords: sum(all.map((item) => item.safetyEscapeWords)),
    transcriptLagP95Ms: optionalPercentile(all.map((item) => item.transcriptLagMs)),
    sttErrorRate: proportion(
      count(all, (item) => item.sttError),
      all.length,
    ),
    endOfTurnErrorRate: proportion(
      count(all, (item) => item.endOfTurnError),
      all.length,
    ),
    costPerTurnUsd: sum(all.map((item) => item.estimatedCostUsd)) / all.length,
    rubricSessions: rubric.length,
    rubricMean: rubric.length === 0 ? null : sum(rubric) / rubric.length,
  };
}

export function compareArms(
  pipelineResult: S2SArmResult,
  s2sResult: S2SArmResult,
  now: () => Date = () => new Date(),
): S2SComparison {
  if (pipelineResult.arm !== 'pipeline' || s2sResult.arm !== 's2s') {
    throw new Error('compareArms needs one pipeline result and one s2s result, in that order');
  }
  const pipeline = summariseArm(pipelineResult);
  const s2s = summariseArm(s2sResult);
  const offPlanFails = s2s.offPlanRate.rate > OFF_PLAN_FAIL_RATE;
  const transcriptLagFails =
    s2s.transcriptLagP95Ms === null || s2s.transcriptLagP95Ms > TRANSCRIPT_LAG_FAIL_MS;
  const costRatio =
    pipeline.costPerTurnUsd === 0 ? null : s2s.costPerTurnUsd / pipeline.costPerTurnUsd;
  const rubricSufficient =
    pipeline.rubricSessions >= RUBRIC_SESSIONS_REQUIRED &&
    s2s.rubricSessions >= RUBRIC_SESSIONS_REQUIRED;
  const verdicts = { offPlanFails, transcriptLagFails, rubricSufficient };
  return {
    generatedAt: now().toISOString(),
    pipeline,
    s2s,
    offPlanFails,
    transcriptLagFails,
    costRatio,
    costRatioNoted: costRatio !== null && costRatio > COST_RATIO_NOTE,
    rubricSufficient,
    recommendation: recommend({ ...verdicts, pipeline, s2s }),
    reasons: reasonsFor({ ...verdicts, pipeline, s2s }),
  };
}

type Verdicts = Readonly<{
  offPlanFails: boolean;
  transcriptLagFails: boolean;
  rubricSufficient: boolean;
  pipeline: ArmSummary;
  s2s: ArmSummary;
}>;

function reasonsFor(input: Verdicts): readonly string[] {
  const reasons: string[] = [];
  const { s2s, pipeline } = input;
  if (input.offPlanFails)
    reasons.push(`off-plan rate ${pct(s2s.offPlanRate.rate)} exceeds ${pct(OFF_PLAN_FAIL_RATE)}`);
  if (input.transcriptLagFails)
    reasons.push(
      s2s.transcriptLagP95Ms === null
        ? 'transcript lag was not measured'
        : `transcript lag p95 ${String(s2s.transcriptLagP95Ms)} ms exceeds ${String(TRANSCRIPT_LAG_FAIL_MS)} ms`,
    );
  if (!input.rubricSufficient)
    reasons.push(
      `rubric sessions ${String(pipeline.rubricSessions)}/${String(s2s.rubricSessions)} below ${String(RUBRIC_SESSIONS_REQUIRED)} per arm`,
    );
  if (s2s.oralReadingTurns > 0)
    reasons.push(
      `${String(s2s.oralReadingTurns)} oral-reading turns found on the s2s arm; excluded by rule`,
    );
  return reasons;
}

/** A golden-set run of the pipeline, read as the pipeline arm. */
export function pipelineArmFromGolden(result: VoiceCandidateResult): S2SArmResult {
  return {
    arm: 'pipeline',
    provider: result.candidate,
    generatedAt: result.generatedAt,
    observations: result.observations.map((item): S2SObservation => ({
      turnId: item.scenarioId,
      firstAudioMs: item.firstAudioMs,
      silenceToReplyMs: item.endToEndMs,
      interruptionToSilenceMs: item.interruptionSilenceMs,
      overlapCount: 0,
      offPlan: false,
      safetyEscapeWords: 0,
      transcriptLagMs: null,
      sttError: !item.transcriptCorrect,
      endOfTurnError: !item.endOfTurnCorrect,
      oralReading: false,
      estimatedCostUsd: item.estimatedCostUsd,
      rubricScore: null,
    })),
  };
}

function recommend(input: Verdicts): Recommendation {
  if (input.offPlanFails || input.transcriptLagFails) return 'pipeline';
  if (!input.rubricSufficient) return 'insufficient_evidence';
  const faster = input.s2s.silenceToReplyP95Ms < input.pipeline.silenceToReplyP95Ms;
  const asWarm = (input.s2s.rubricMean ?? 0) >= (input.pipeline.rubricMean ?? 0);
  return faster && asWarm ? 'hybrid' : 'pipeline';
}

function uniqueScores(items: readonly S2SObservation[]): number[] {
  const scores = new Set<number>();
  for (const item of items) if (item.rubricScore !== null) scores.add(item.rubricScore);
  return [...scores];
}

function count<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function percentile(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const value = sorted[Math.max(0, index)];
  if (value === undefined) throw new Error('A percentile needs at least one value');
  return value;
}

function optionalPercentile(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : percentile(present);
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
