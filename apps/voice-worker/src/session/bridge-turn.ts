import type { TutorMove } from '@aria/shared';
import { classifyIntent } from '@aria/tutor';

import type { BridgePlayer } from '@/session/bridge-player';
import type { FirstAudioEstimate } from '@/session/first-audio-estimate';

export type BridgeTurn = Readonly<{
  /** A move went out. Its kind is what makes the next gap a transition rather than a reply. */
  observeMove(move: TutorMove): void;
  /**
   * A final transcript arrived. Called the moment it does, before the turn queues behind
   * whatever is still speaking, because rule 3 is about what happens in exactly that window.
   */
  observeTranscript(): void;
  /** The child started speaking again; rule 3, if it happened after the transcript. */
  observeSpeechStarted(): void;
  /** A final transcript arrived: cover the gap it just opened, if the rules allow one. */
  cover(input: Readonly<{ text: string; confidence?: number | undefined }>): void;
  /** The turn's request went out; the first-audio clock starts here. */
  turnStarted(): void;
  /** The turn's first sentence reached the speaker. */
  firstSpoken(): void;
  /** Resolves once a playing clip has finished, so nothing is ever cut across. */
  settle(): Promise<void>;
}>;

/**
 * Everything the bridge path needs to know about one turn, in one place (P2H-09).
 *
 * The classification here is the rules-only pass from `@aria/tutor` with no answer key: the
 * worker has never seen the item, and asking the API what the child meant would cost the round
 * trip this whole mechanism exists to hide. It only ever picks a bucket, and the real
 * classification — the one that decides what Aria actually says — still happens in the API.
 */
export function createBridgeTurn(
  input: Readonly<{
    player: BridgePlayer;
    estimate: FirstAudioEstimate;
    now(): number;
  }>,
): BridgeTurn {
  let afterMoveKind: TutorMove['kind'] | null = null;
  // Two stamps off one counter rather than a flag: a turn queues behind whatever is still
  // speaking, so "the child started again" only means anything relative to *which* transcript.
  // A flag would carry a false interruption from three turns ago into a gap that is nobody's.
  let tick = 0;
  let transcriptAt = 0;
  let speechStartedAt = 0;
  return {
    observeMove: (move) => {
      afterMoveKind = move.kind;
    },
    observeTranscript: () => {
      tick += 1;
      transcriptAt = tick;
    },
    observeSpeechStarted: () => {
      tick += 1;
      speechStartedAt = tick;
    },
    cover: ({ text, confidence }) => {
      const intent = classifyIntent(text, { answerKey: null, speechConfidence: confidence }).intent;
      input.player.cover({
        intent,
        afterMoveKind,
        childSpeaking: speechStartedAt > transcriptAt,
        expectedFirstAudioMs: input.estimate.expectedMs(),
      });
    },
    turnStarted: () => {
      input.estimate.started(input.now());
    },
    firstSpoken: () => {
      input.estimate.heard(input.now());
    },
    settle: () => input.player.settle(),
  };
}
