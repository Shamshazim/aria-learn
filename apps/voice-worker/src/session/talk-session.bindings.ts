import { AgentSessionEventTypes, type voice } from '@livekit/agents';

import { crisisInstruction, steerInstruction } from '@/session/talk-instructions';
import type { TalkRuntime } from '@/session/talk-runtime';

/**
 * The bindings a talking session needs besides its tools: the harness-initiated turns, the
 * two halves of the transcript with their safety checks, and the ending. Split from
 * `talk-session.ts` for the 300-line rule; the session wires them, this file says what they do.
 */
export type RoomRef = Readonly<{ sessionId: string; connectionEpoch: number }>;

/** A harness-initiated turn — the opening, a silence rung — voiced in the model's own words. */
export async function voiceHarnessTurn(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  speech: AsyncIterable<string>,
  instruction: (lines: readonly string[]) => string,
): Promise<void> {
  runtime.beginTurn();
  const lines: string[] = [];
  for await (const line of speech) lines.push(line);
  runtime.endTurn();
  session.generateReply({ instructions: instruction(lines), allowInterruptions: true });
}

/**
 * The child's words go to the API as they are transcribed: the transcript stays complete, and
 * a disclosure gets the fixed crisis line the pipeline would give, spoken over whatever the
 * model was about to say.
 */
export function bindTranscripts(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  room: RoomRef,
): void {
  session.on(AgentSessionEventTypes.UserInputTranscribed, (event) => {
    const text = event.transcript.trim();
    if (!event.isFinal || text === '') return;
    void runtime.publishState({ kind: 'HEARD', text }).catch(() => undefined);
    void runtime.talk
      .heard(room.sessionId, { connectionEpoch: room.connectionEpoch, text })
      .then((result) => {
        if (result.crisis === null) return;
        void session.interrupt({ force: true }).await.then(() => {
          session.generateReply({
            instructions: crisisInstruction(result.crisis?.say ?? ''),
            allowInterruptions: false,
          });
        });
      })
      .catch(() => undefined);
  });
}

export function reportSpoken(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  room: RoomRef,
  text: string,
): void {
  void runtime.publishState({ kind: 'CAPTION', text }).catch(() => undefined);
  void runtime.talk
    .spoken(room.sessionId, { connectionEpoch: room.connectionEpoch, text })
    .then((result) => {
      if (result.verdict !== 'unsafe') return;
      runtime.metrics.offPlan(text.split(/\s+/u).length);
      void session.interrupt({ force: true }).await.then(() => {
        session.generateReply({ instructions: steerInstruction(), allowInterruptions: true });
      });
    })
    .catch(() => undefined);
}

/** The session ends after Aria has finished her last sentence, not while she is saying it. */
export function bindEnding(
  session: voice.AgentSession,
  runtime: TalkRuntime,
  finish: () => void,
): Readonly<{ afterSpeech(): void }> {
  let pending = false;
  let spoke = false;
  session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
    if (event.newState === 'speaking') spoke = true;
    if (event.oldState !== 'speaking') return;
    void runtime.metrics.closeTurn({ oralReading: false, sttError: false, estimatedCostUsd: 0 });
    if (pending && spoke) finish();
  });
  return {
    afterSpeech: () => {
      pending = true;
      spoke = false;
    },
  };
}
