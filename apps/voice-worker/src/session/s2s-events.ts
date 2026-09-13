import { AgentSessionEventTypes, type JobContext, type voice } from '@livekit/agents';
import { RoomEvent } from '@livekit/rtc-node';

import type { AgentState, VoiceClientEvent } from '@aria/shared';

import {
  createAcknowledgementGate,
  type AcknowledgementGate,
} from '@/session/acknowledgement-gate';
import { parseClientEvent } from '@/session/client-event';
import type { MoveStream } from '@/session/move-stream';
import type { S2SMetrics } from '@/session/s2s-metrics';
import type { SilenceTimer } from '@/session/silence-timer';

/**
 * P2H-15: the room and session events a speech-to-speech session listens to.
 *
 * Smaller than the pipeline's binding on purpose. There is no `SYNC` replay here — a realtime
 * model cannot `say()` a stored sentence — and no metric forwarding to the control plane; the
 * spike measures itself into its run log. What is kept is what a session cannot do without:
 * the acknowledgement gate, the child's `STOP`, what the child did on the screen, and the
 * close paths.
 */
export function bindS2SEvents(
  input: Readonly<{
    job: JobContext;
    session: voice.AgentSession;
    participantIdentity: string;
    moves: Pick<MoveStream, 'acceptAcknowledgement' | 'cancelGeneration' | 'activeGenerationId'>;
    silence: SilenceTimer;
    metrics: S2SMetrics;
    finish(): void;
    /** A tap or some typing on the screen; bound after the session starts. */
    onScreenAnswer?(event: Extract<VoiceClientEvent, { kind: 'SCREEN_ANSWER' }>): void;
    /** The child ended the session on the screen; bound after the session starts. */
    onLeave?(): void;
    /** The child pressed skip on the screen; bound after the session starts. */
    onScreenSkip?(event: Extract<VoiceClientEvent, { kind: 'SCREEN_SKIP' }>): void;
    /** Aria started or stopped talking, so the screen's status line can follow her. */
    onAgentState?(state: AgentState): void;
  }>,
): AcknowledgementGate {
  const gate = createAcknowledgementGate();
  input.session.on(AgentSessionEventTypes.Close, () => {
    gate.close();
    input.finish();
  });
  input.job.room.on(RoomEvent.Disconnected, gate.close);
  input.job.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    if (participant.identity !== input.participantIdentity) return;
    gate.close();
    input.finish();
  });
  input.session.on(AgentSessionEventTypes.UserStateChanged, (event) => {
    if (event.newState === 'speaking') {
      input.silence.speechPartial();
      if (input.session.agentState === 'speaking') {
        input.metrics.overlap();
        input.metrics.interruptionStarted();
      }
    }
    // The vendor's VAD decided the child stopped; the reply is timed from here.
    if (event.oldState === 'speaking' && event.newState === 'listening')
      input.metrics.childStopped();
  });
  input.session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
    input.silence.speaking(event.newState === 'speaking');
    if (event.newState === 'speaking') input.metrics.firstAudio();
    if (event.oldState === 'speaking') input.metrics.interruptionSilent();
    input.onAgentState?.(agentStateOf(event.newState));
  });
  bindClientEvents(input, gate);
  return gate;
}

/** The vendor's five agent states, as the three the screen distinguishes. */
function agentStateOf(state: string): AgentState {
  if (state === 'speaking') return 'speaking';
  if (state === 'thinking') return 'thinking';
  return 'listening';
}

function bindClientEvents(
  input: Parameters<typeof bindS2SEvents>[0],
  gate: AcknowledgementGate,
): void {
  input.job.room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    if (topic !== 'aria.client-event') return;
    const event = parseClientEvent(payload);
    if (event === null) return;
    if (event.kind === 'ACK') {
      input.moves.acceptAcknowledgement(event.acknowledgedSeq);
      gate.acknowledge();
      return;
    }
    if (event.kind === 'SCREEN_ANSWER') {
      input.silence.speechPartial();
      input.onScreenAnswer?.(event);
      return;
    }
    if (event.kind === 'LEAVE') {
      input.onLeave?.();
      return;
    }
    if (event.kind === 'SCREEN_SKIP') {
      input.silence.speechPartial();
      input.onScreenSkip?.(event);
      return;
    }
    if (event.kind !== 'STOP' || event.generationId !== input.moves.activeGenerationId()) return;
    input.moves.cancelGeneration(event.generationId);
    input.metrics.interruptionStarted();
    void input.session.interrupt({ force: true });
  });
}
