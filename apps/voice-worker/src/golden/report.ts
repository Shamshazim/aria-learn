import { proportion, type Proportion } from '@aria/voice';

import type { VoiceCandidateResult, VoiceObservation } from './result.schema';

export type VoiceGoldenReport = Readonly<{
  candidate: string;
  humanLabelled: number;
  synthetic: number;
  transcriptAccuracy: Proportion | null;
  endOfTurnAccuracy: Proportion | null;
  interruptionSilenceP95Ms: number | null;
  firstAudioP95Ms: number;
  endToEndP95Ms: number;
  falseTeachingCount: number;
  lowConfidenceDurableUpdateCount: number;
  unreviewedSpokenTeachingCount: number;
  estimatedCostUsd: number;
  eligibleForProviderDecision: boolean;
}>;

export function buildVoiceGoldenReport(result: VoiceCandidateResult): VoiceGoldenReport {
  const human = result.observations.filter((item) => item.provenance === 'human_labelled');
  const falseTeachingCount = count(result.observations, (item) => item.falseTeaching);
  const lowConfidenceDurableUpdateCount = count(
    result.observations,
    (item) => item.lowConfidenceDurableUpdate,
  );
  const unreviewedSpokenTeachingCount = count(
    result.observations,
    (item) => item.spokenTeachingApproved !== true,
  );
  return {
    candidate: result.candidate,
    humanLabelled: human.length,
    synthetic: result.observations.length - human.length,
    transcriptAccuracy: accuracy(human, (item) => item.transcriptCorrect),
    endOfTurnAccuracy: accuracy(human, (item) => item.endOfTurnCorrect),
    interruptionSilenceP95Ms: percentile(
      result.observations.flatMap((item) =>
        item.interruptionSilenceMs === null ? [] : [item.interruptionSilenceMs],
      ),
      0.95,
    ),
    firstAudioP95Ms: requiredPercentile(result.observations.map((item) => item.firstAudioMs)),
    endToEndP95Ms: requiredPercentile(result.observations.map((item) => item.endToEndMs)),
    falseTeachingCount,
    lowConfidenceDurableUpdateCount,
    unreviewedSpokenTeachingCount,
    estimatedCostUsd: result.observations.reduce((total, item) => total + item.estimatedCostUsd, 0),
    eligibleForProviderDecision:
      human.length > 0 &&
      falseTeachingCount === 0 &&
      lowConfidenceDurableUpdateCount === 0 &&
      unreviewedSpokenTeachingCount === 0,
  };
}

function accuracy(
  items: readonly VoiceObservation[],
  passed: (item: VoiceObservation) => boolean,
): Proportion | null {
  if (items.length === 0) return null;
  return proportion(count(items, passed), items.length);
}

function count(
  items: readonly VoiceObservation[],
  predicate: (item: VoiceObservation) => boolean,
): number {
  return items.filter(predicate).length;
}

function requiredPercentile(values: readonly number[]): number {
  const value = percentile(values, 0.95);
  if (value === null) throw new Error('Voice golden result has no latency observations');
  return value;
}

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.ceil(quantile * ordered.length) - 1;
  return ordered[Math.max(0, index)] ?? null;
}
