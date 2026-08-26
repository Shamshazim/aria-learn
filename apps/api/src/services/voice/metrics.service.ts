import type { Band, BridgeMetric, VoiceMetricRequest } from '@aria/shared';

import { ForbiddenError, NotFoundError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';

export function createVoiceMetricsService(deps: {
  sessions: Pick<SessionRepository, 'findById'>;
  voiceSessions: Pick<VoiceSessionRepository, 'findOpen'>;
  events: Pick<SessionEventRepository, 'append'>;
  /** P2H-09: bridges are counted as well as recorded, so a deployment can watch the cadence. */
  observeBridge?: (input: Readonly<{ band: Band; metric: BridgeMetric }>) => void;
  clock: Clock;
}): Readonly<{ record(sessionId: string, input: VoiceMetricRequest): Promise<void> }> {
  return {
    record: async (sessionId, input) => {
      const session = await deps.sessions.findById(sessionId);
      if (session === null) throw new NotFoundError('session not found');
      const voice = await deps.voiceSessions.findOpen(sessionId);
      if (voice === null) throw new ForbiddenError('voice session is not open');
      if (voice.connectionEpoch !== input.connectionEpoch)
        throw new ValidationError('stale voice connection epoch');
      await deps.events.append({
        sessionId,
        actor: 'system',
        kind: 'VOICE_METRIC',
        text: null,
        skillCode: null,
        correct: null,
        latencyMs: primaryLatency(input.metric),
        evidence: {},
        payload: input.metric,
        at: deps.clock.now(),
      });
      if (input.metric.kind === 'bridge') {
        deps.observeBridge?.({ band: session.band, metric: input.metric });
      }
    },
  };
}

/** A bridge has no latency of its own to record; it is the thing that fills somebody else's. */
function primaryLatency(metric: VoiceMetricRequest['metric']): number | null {
  if (metric.kind === 'end_of_turn') return Math.round(metric.endOfUtteranceMs);
  if (metric.kind === 'tts') return Math.round(metric.ttfbMs);
  if (metric.kind === 'stt') return Math.round(metric.audioDurationMs);
  if (metric.kind === 'bridge') return null;
  return Math.round(metric.detectionMs);
}
