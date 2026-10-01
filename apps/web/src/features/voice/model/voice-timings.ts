import type { AgentState } from '@aria/shared';

import type { TurnTimingReporter } from '@/lib/observability/timing';

/**
 * Where the voice's two §11 bars start and stop (X-04 part 2).
 *
 * It sits beside the transport rather than inside `useRealtimeVoice` because it is protocol
 * reasoning, not UI: which room event means "the speaker made a sound" and which worker state
 * means "she stopped" are decisions about the voice protocol, and they are testable without
 * rendering anything (CODE-STANDARDS §3.2).
 *
 * The other halves of both bars live in `useVoiceActions`, which is where the browser permits
 * sound and where the local VAD notices a child talking over Aria.
 *
 * Built once per reporter and not per render: the handlers it returns are registered on room
 * events and on audio elements, so a new object each render would register them again.
 */
export type VoiceTimings = Readonly<{
  /** The session these measurements belong to, so the report can name it. */
  bind(sessionId: string | null): void;
  /** The room is connected: sound is now possible, and `audio_unlocked` starts counting. */
  roomConnected(): void;
  /** A remote audio element was attached. Watched for the first sound out of the speaker. */
  watchAudioElement(element: HTMLMediaElement): void;
  /** What the worker says Aria is doing now. */
  agentState(state: AgentState): void;
  /** The room is gone. Anything still being measured never finished and is not reported. */
  disconnected(): void;
}>;

export function createVoiceTimings(reporter?: TurnTimingReporter): VoiceTimings {
  return {
    bind: (sessionId) => {
      reporter?.bind(sessionId);
    },
    roomConnected: () => {
      reporter?.start('audio_unlocked');
    },
    watchAudioElement: (element) => {
      if (reporter !== undefined) watchFirstSound(reporter, element);
    },
    agentState: (state) => {
      if (reporter !== undefined) applyAgentState(reporter, state);
    },
    disconnected: () => {
      reporter?.cancel('audio_unlocked');
      reporter?.cancel('audible_welcome');
      reporter?.cancel('interrupt_silence');
    },
  };
}

/**
 * `playing` on the attached element, once.
 *
 * This is the closest a page can get to "a sample left the speaker": the element fires it when
 * it actually begins rendering audio, which is after the track is subscribed, after the browser
 * has allowed playback, and after the first frames have arrived.
 *
 * It is not perfect, and the imprecision is worth naming. A track that carries a moment of
 * leading silence fires `playing` on the silence, so the number can be slightly optimistic for
 * the realtime voice. The alternative — waiting for the worker to say `AGENT_STATE: speaking`
 * — is pessimistic by a whole network leg back from the worker and does not exist at all on
 * the pipeline voice, which sends no agent states. So `playing` is the measurement, and the
 * agent state below is the backstop.
 */
function watchFirstSound(reporter: TurnTimingReporter, element: HTMLMediaElement): void {
  element.addEventListener(
    'playing',
    () => {
      reporter.stop('audible_welcome');
    },
    { once: true },
  );
}

function applyAgentState(reporter: TurnTimingReporter, state: AgentState): void {
  if (state === 'speaking') {
    // The backstop for the audible welcome. `stop` is a no-op once the measurement has been
    // taken, so this only ever fires where `playing` never did — a browser that gave us no
    // `playing` event, or a voice whose audio arrived some other way.
    reporter.stop('audible_welcome');
    return;
  }
  // She has stopped talking, which is the end of the §11 interrupt bar. Timestamped on receipt
  // here rather than at the worker on purpose: the bar is about when the room went quiet for
  // the child, so the leg back across the network is part of what they waited.
  //
  // `listening` also arrives at the natural end of every turn. There, nothing is being measured
  // and this is a no-op — and where a child talked over the last sentence of a turn that then
  // finished on its own, the measurement is exactly right: they interrupted and Aria kept going
  // until she was done.
  reporter.stop('interrupt_silence');
}
