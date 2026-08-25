import type { VoiceMetricRequest } from '@aria/shared';

import { ForbiddenError, NotFoundError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';

export function createVoiceMetricsService(deps: {
  sessions: Pick<SessionRepository, 'findById'>;
  voiceSessions: Pick<VoiceSessionRepository, 'findOpen'>;
  events: Pick<SessionEventRepository, 'append'>;
  clock: Clock;
}): Readonly<{ record(sessionId: string, input: VoiceMetricRequest): Promise<void> }> {
  return {
    record: async (sessionId, input) => {
      if ((await deps.sessions.findById(sessionId)) === null)
        throw new NotFoundError('session not found');
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
    },
  };
}

function primaryLatency(metric: VoiceMetricRequest['metric']): number {
  if (metric.kind === 'end_of_turn') return metric.endOfUtteranceMs;
  if (metric.kind === 'tts') return metric.ttfbMs;
  if (metric.kind === 'stt') return metric.audioDurationMs;
  return metric.detectionMs;
}
