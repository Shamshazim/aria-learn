import type { VoiceHeardResponse, VoiceSpokenResponse } from '@aria/shared';

import type { Clock } from '@/lib/clock';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { isUnsafeChildFacingText } from '@/safety/crisis/detect';
import type { InputSafetyService } from '@/safety/flag.service';
import { openTalkSession, type TalkGuardDeps } from '@/services/voice/talk-guard';

/**
 * The transcript of a session where Aria talks, and the two safety checks on it.
 *
 * The child's words are recorded as the same `SPEECH_FINAL` the pipeline records, so memory
 * consolidation, the dialogue window and the parent transcript see one kind of session. They
 * go through the crisis detector on the way; a disclosure gets the fixed response the pipeline
 * gives, and the flag and escalation the pipeline raises. Aria's words are recorded as she
 * said them — the model's own sentences, not a gated plan — and checked with the same rule the
 * content path applies to generated text. An unsafe verdict is the worker's cue to cut in.
 */
export type TalkEventsDeps = TalkGuardDeps &
  Readonly<{
    events: Pick<SessionEventRepository, 'append'>;
    safety: Pick<InputSafetyService, 'check'>;
    clock: Clock;
  }>;

export type HeardVia = 'voice' | 'screen';

export type TalkEventsService = Readonly<{
  heard(
    sessionId: string,
    connectionEpoch: number,
    text: string,
    via?: HeardVia,
  ): Promise<VoiceHeardResponse>;
  spoken(sessionId: string, connectionEpoch: number, text: string): Promise<VoiceSpokenResponse>;
}>;

export function createTalkEventsService(deps: TalkEventsDeps): TalkEventsService {
  return {
    heard: (sessionId, connectionEpoch, text, via = 'voice') =>
      heard(deps, { sessionId, connectionEpoch, text, via }),
    spoken: (sessionId, connectionEpoch, text) => spoken(deps, sessionId, connectionEpoch, text),
  };
}

async function heard(
  deps: TalkEventsDeps,
  input: Readonly<{ sessionId: string; connectionEpoch: number; text: string; via: HeardVia }>,
): Promise<VoiceHeardResponse> {
  const { text, via } = input;
  const session = await openTalkSession(deps, input.sessionId, input.connectionEpoch);
  const verdict = await deps.safety.check({
    text,
    studentId: session.studentId,
    sessionId: session.id,
    eventId: null,
  });
  await deps.events.append({
    sessionId: session.id,
    actor: 'child',
    kind: 'SPEECH_FINAL',
    text,
    skillCode: null,
    correct: null,
    latencyMs: null,
    evidence: verdict.safe ? {} : { safety: 'crisis' },
    // Typed on the screen or said out loud, the words reach Aria the same way; the payload
    // keeps which, so the transcript can say "wrote" where the child wrote.
    payload: { source: via === 'screen' ? 'screen' : 'realtime', text },
    at: deps.clock.now(),
  });
  return { crisis: verdict.safe ? null : { say: verdict.response } };
}

async function spoken(
  deps: TalkEventsDeps,
  sessionId: string,
  connectionEpoch: number,
  text: string,
): Promise<VoiceSpokenResponse> {
  const session = await openTalkSession(deps, sessionId, connectionEpoch);
  const unsafe = isUnsafeChildFacingText(text);
  await deps.events.append({
    sessionId: session.id,
    actor: 'aria',
    kind: 'SPOKEN',
    text,
    skillCode: null,
    correct: null,
    latencyMs: null,
    evidence: unsafe ? { safety: 'unsafe_output' } : {},
    payload: { source: 'realtime', text },
    at: deps.clock.now(),
  });
  return { verdict: unsafe ? 'unsafe' : 'ok' };
}
