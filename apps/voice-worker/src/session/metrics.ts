import type { VoiceMetric } from '@aria/shared';

import type { AgentMetrics } from '@livekit/agents';

export function toVoiceMetric(metric: AgentMetrics): VoiceMetric | null {
  switch (metric.type) {
    case 'eou_metrics':
      return {
        kind: 'end_of_turn',
        endOfUtteranceMs: metric.endOfUtteranceDelayMs,
        transcriptionMs: metric.transcriptionDelayMs,
      };
    case 'tts_metrics':
      return {
        kind: 'tts',
        ttfbMs: metric.ttfbMs,
        durationMs: metric.durationMs,
        cancelled: metric.cancelled,
      };
    case 'stt_metrics':
      return { kind: 'stt', audioDurationMs: metric.audioDurationMs };
    case 'interruption_metrics':
      return {
        kind: 'interruption',
        detectionMs: metric.detectionDelay,
        interruptions: metric.numInterruptions,
        backchannels: metric.numBackchannels,
      };
    case 'eot_inference_metrics':
      return {
        kind: 'turn_detector',
        totalMs: metric.totalDuration,
        inferenceMs: metric.predictionDuration,
        detectionMs: metric.detectionDelay,
      };
    default:
      return null;
  }
}
