import type { TutorMove, VoiceMetric } from '@aria/shared';
import {
  chooseBridge,
  createBridgePicker,
  type BridgeSkipRule,
  type BridgeContext,
  type BridgeClip,
} from '@aria/voice';

import type { LoadedBridge } from '@/api/bridge-client';
import type { AriaAgentSession } from '@/session/agent-session';

import type { AudioFrame } from '@livekit/rtc-node';

type BridgeMetric = Extract<VoiceMetric, { kind: 'bridge' }>;

export type BridgePlayer = Readonly<{
  /**
   * Considers the gap this turn is about to open, and covers it if the rules allow.
   *
   * Returns once the clip has been handed to the session, not once it has finished: the answer
   * is being written the whole time it plays, which is the entire point.
   */
  cover(
    input: Readonly<{
      intent: BridgeContext['intent'];
      afterMoveKind: TutorMove['kind'] | null;
      expectedFirstAudioMs: number | null;
      childSpeaking: boolean;
    }>,
  ): void;
  /** Waits for a playing clip to finish, so the first real sentence never cuts across it. */
  settle(): Promise<void>;
}>;

export function createBridgePlayer(
  input: Readonly<{
    session: Pick<AriaAgentSession, 'say'>;
    band: BridgeContext['band'];
    clips: readonly LoadedBridge[];
    seed: number;
    report(metric: BridgeMetric): void;
  }>,
): BridgePlayer {
  const picker = createBridgePicker({ seed: input.seed });
  const clips = input.clips.map((loaded) => loaded.clip);
  const audio = new Map(input.clips.map((loaded) => [loaded.clip.id, loaded.audio]));
  let turnIndex = 0;
  let lastBridgeTurn: number | null = null;
  let playing: Promise<void> = Promise.resolve();
  return {
    settle: () => playing,
    cover: (turn) => {
      const context: BridgeContext = {
        ...turn,
        band: input.band,
        turnsSinceBridge: lastBridgeTurn === null ? null : turnIndex - lastBridgeTurn - 1,
      };
      const choice = chooseBridge({ context, clips, picker, turnIndex });
      const before = picker.repeats();
      turnIndex += 1;
      if (!choice.play) {
        input.report(skipped(choice.rule));
        return;
      }
      lastBridgeTurn = turnIndex - 1;
      playing = play(input.session, choice.clip, audio.get(choice.clip.id) ?? []);
      input.report({
        kind: 'bridge',
        played: true,
        bucket: choice.clip.bucket,
        rule: null,
        repeat: picker.repeats() > before,
      });
    },
  };
}

/**
 * The clip's own recorded audio, in the session's own voice.
 *
 * `allowInterruptions` is true for the same reason every other utterance sets it: a child
 * talking over "let me think" is a child who has more to say, and P2H-07 already treats that as
 * a barge-in rather than an answer.
 */
async function play(
  session: Pick<AriaAgentSession, 'say'>,
  clip: BridgeClip,
  frames: readonly AudioFrame[],
): Promise<void> {
  const handle = session.say(clip.text, {
    audio: audioStream(frames),
    allowInterruptions: true,
    // The transcript is Aria's; a bridge is something she said, and the child heard it.
    addToChatCtx: true,
  });
  await handle.waitForPlayout();
}

function audioStream(frames: readonly AudioFrame[]): ReadableStream<AudioFrame> {
  return new ReadableStream<AudioFrame>({
    start: (controller) => {
      for (const frame of frames) controller.enqueue(frame);
      controller.close();
    },
  });
}

function skipped(rule: BridgeSkipRule): BridgeMetric {
  return { kind: 'bridge', played: false, bucket: null, rule, repeat: false };
}
