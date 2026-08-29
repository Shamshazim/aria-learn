import type { S2SObservation } from '@/golden/s2s-result.schema';

/**
 * P2H-15: what one speech-to-speech turn cost the child, measured where it happened.
 *
 * The pipeline reports through the control plane's metric endpoint; the spike does not, so
 * the shared protocol stays untouched by an experiment. Each closed turn is one JSONL line
 * in the run log (`VOICE_S2S_RUN_LOG`), which `voice:s2s-compare` reads back as the s2s arm.
 * A worker without a run log still counts — the numbers are what the memo needs, and a
 * sink that fails to write must never fail a session.
 */
export type S2SMetrics = Readonly<{
  /** The vendor's VAD decided the child stopped; the clock the reply is measured on. */
  childStopped(): void;
  /** The first audio frame of a reply left the worker. */
  firstAudio(): void;
  /** The child started talking over Aria; and when the audio actually stopped. */
  interruptionStarted(): void;
  interruptionSilent(): void;
  overlap(): void;
  offPlan(escapedWords: number): void;
  transcriptLag(ms: number): void;
  closeTurn(
    detail: Readonly<{ oralReading: boolean; sttError: boolean; estimatedCostUsd: number }>,
  ): Promise<S2SObservation | null>;
  observations(): readonly S2SObservation[];
}>;

type Clock = Readonly<{ now(): number }>;

type Turn = {
  stoppedAt: number | null;
  firstAudioAt: number | null;
  interruptedAt: number | null;
  interruptionMs: number | null;
  overlaps: number;
  offPlan: boolean;
  escaped: number;
  lagMs: number | null;
};

export function createS2SMetrics(
  input: Clock &
    Readonly<{
      provider: string;
      nextId(): string;
      sink: ((line: string) => Promise<void>) | null;
    }>,
): S2SMetrics {
  const closed: S2SObservation[] = [];
  const log = createRunLog(input.provider, input.sink);
  let turn = freshTurn();
  return {
    childStopped: () => {
      turn.stoppedAt = input.now();
    },
    firstAudio: () => {
      turn.firstAudioAt ??= input.now();
    },
    interruptionStarted: () => {
      turn.interruptedAt = input.now();
    },
    interruptionSilent: () => {
      if (turn.interruptedAt !== null) turn.interruptionMs = input.now() - turn.interruptedAt;
    },
    overlap: () => {
      turn.overlaps += 1;
    },
    offPlan: (escapedWords) => {
      turn.offPlan = true;
      turn.escaped += escapedWords;
    },
    transcriptLag: (ms) => {
      turn.lagMs = turn.lagMs === null ? ms : Math.max(turn.lagMs, ms);
    },
    closeTurn: async (detail) => {
      // A turn without a child stop is Aria's own opening; there is no reply to time.
      if (turn.stoppedAt === null || turn.firstAudioAt === null) return null;
      const observation = observe(input.nextId(), turn, detail);
      closed.push(observation);
      turn = freshTurn();
      await log(observation);
      return observation;
    },
    observations: () => closed,
  };
}

function freshTurn(): Turn {
  return {
    stoppedAt: null,
    firstAudioAt: null,
    interruptedAt: null,
    interruptionMs: null,
    overlaps: 0,
    offPlan: false,
    escaped: 0,
    lagMs: null,
  };
}

function observe(
  turnId: string,
  turn: Turn,
  detail: Readonly<{ oralReading: boolean; sttError: boolean; estimatedCostUsd: number }>,
): S2SObservation {
  const replyMs = Math.max(0, (turn.firstAudioAt ?? 0) - (turn.stoppedAt ?? 0));
  return {
    turnId,
    firstAudioMs: replyMs,
    silenceToReplyMs: replyMs,
    interruptionToSilenceMs: turn.interruptionMs,
    overlapCount: turn.overlaps,
    offPlan: turn.offPlan,
    safetyEscapeWords: turn.escaped,
    transcriptLagMs: turn.lagMs,
    sttError: detail.sttError,
    endOfTurnError: false,
    oralReading: detail.oralReading,
    estimatedCostUsd: detail.estimatedCostUsd,
    rubricScore: null,
  };
}

/** The header line names the provider once; every line after it is one closed turn. */
function createRunLog(
  provider: string,
  sink: ((line: string) => Promise<void>) | null,
): (observation: S2SObservation) => Promise<void> {
  let headerWritten = false;
  return async (observation) => {
    if (sink === null) return;
    try {
      if (!headerWritten) {
        headerWritten = true;
        await sink(`${JSON.stringify({ provider })}\n`);
      }
      await sink(`${JSON.stringify(observation)}\n`);
    } catch {
      // The run log is evidence for a memo; the session it describes matters more than it.
    }
  };
}
