import { AgentSessionEventTypes, type JobContext } from '@livekit/agents';
import { RoomEvent, type LocalParticipant } from '@livekit/rtc-node';

import type { VoiceMetric } from '@aria/shared';

import type { AcknowledgementGate } from '@/session/acknowledgement-gate';
import { createAcknowledgementGate } from '@/session/acknowledgement-gate';
import type { AriaAgentSession } from '@/session/agent-session';
import { parseClientEvent } from '@/session/client-event';
import { toVoiceMetric } from '@/session/metrics';
import type { MoveStream } from '@/session/move-stream';
import type { SilenceTimer } from '@/session/silence-timer';
import { speakPending } from '@/session/speak';

const encoder = new TextEncoder();

export type VoiceEventBindings = Readonly<{
  job: JobContext;
  silence: SilenceTimer;
  participantIdentity: string;
  localParticipant: LocalParticipant;
  moves: MoveStream;
  session: AriaAgentSession;
  isSessionStarted(): boolean;
  finish(): void;
  recordMetric(metric: VoiceMetric): Promise<void>;
}>;

export function bindVoiceEvents(input: VoiceEventBindings): AcknowledgementGate {
  const gate = createAcknowledgementGate();
  bindCloseEvents(input, gate);
  input.session.on(AgentSessionEventTypes.UserTranscriptionTimeout, () => {
    void input.localParticipant.publishData(encoder.encode('{"kind":"TRANSCRIPT_UNCLEAR"}'), {
      reliable: true,
      topic: 'aria.voice-state',
    });
  });
  input.session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
    // A child cannot be silent while being spoken to, so the countdown pauses for Aria's turn.
    input.silence.speaking(event.newState === 'speaking');
    if (event.oldState === 'speaking' && event.newState !== 'speaking') {
      reportSpeechFinished(input);
    }
  });
  input.session.on(AgentSessionEventTypes.MetricsCollected, (event) => {
    const metric = toVoiceMetric(event.metrics);
    if (metric === null) return;
    void input.recordMetric(metric).catch(() => {
      void input.localParticipant.publishData(encoder.encode('{"kind":"METRICS_UNAVAILABLE"}'), {
        reliable: true,
        topic: 'aria.voice-state',
      });
    });
  });
  input.job.room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    if (topic !== 'aria.client-event') return;
    const event = parseClientEvent(payload);
    if (event === null) return;
    if (event.kind === 'ACK') {
      input.moves.acceptAcknowledgement(event.acknowledgedSeq);
      gate.acknowledge();
      return;
    }
    if (!input.isSessionStarted()) return;
    if (event.kind === 'SYNC') {
      void speakPending(input.session, input.moves, input.finish);
      return;
    }
    if (event.kind === 'SPEECH_STARTED') {
      input.silence.speechPartial();
      void discard(input.moves.speechStarted());
      return;
    }
    // The screen answers through the room only where a realtime model is the voice; here the
    // browser sends its answers to the API itself, so a stray one is nothing to act on.
    if (event.kind !== 'STOP') return;
    if (event.generationId !== input.moves.activeGenerationId()) return;
    // P2H-07: the child is talking over this answer. Nothing more from it gets spoken, and how
    // far they got is carried on the next turn so the transcript records what they heard.
    input.moves.cancelGeneration(event.generationId);
    void input.session.interrupt({ force: true });
  });
  return gate;
}

function bindCloseEvents(input: VoiceEventBindings, gate: AcknowledgementGate): void {
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
}

function reportSpeechFinished(
  input: Readonly<{
    localParticipant: LocalParticipant;
    moves: MoveStream;
    finish(): void;
  }>,
): void {
  input.moves.clearGeneration();
  const acknowledgedSeq = input.moves.takePendingPlaybackSeq();
  const reported =
    acknowledgedSeq === 0
      ? Promise.resolve()
      : input.localParticipant.publishData(
          encoder.encode(JSON.stringify({ kind: 'SPEECH_FINISHED', acknowledgedSeq })),
          { reliable: true, topic: 'aria.voice-state' },
        );
  if (input.moves.terminalSpeechPending()) void reported.finally(input.finish);
}

async function discard(values: AsyncIterable<unknown>): Promise<void> {
  for await (const _value of values) {
    // The observation is persisted by the API; it never creates child-facing output.
  }
}
