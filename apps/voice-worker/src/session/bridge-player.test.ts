import { AudioFrame } from '@livekit/rtc-node';
import { describe, expect, it, vi } from 'vitest';

import type { BridgeMetric } from '@aria/shared';

import type { LoadedBridge } from '@/api/bridge-client';
import type { AriaAgentSession } from '@/session/agent-session';
import { createBridgePlayer } from '@/session/bridge-player';

function clips(count: number): readonly LoadedBridge[] {
  return Array.from({ length: count }, (_value, index) => ({
    clip: {
      id: `clip-${String(index)}`,
      bucket: 'acknowledge' as const,
      band: 'middle' as const,
      voice: 'voice-middle',
      text: `Okay ${String(index)}.`,
      durationMs: 800,
    },
    audio: [new AudioFrame(new Int16Array(2_400), 24_000, 1, 2_400)],
  }));
}

/**
 * A session that records what was said and when, so a test can prove nothing overlapped.
 * `waitForPlayout` resolves on the next tick, which is the earliest a real clip could finish.
 */
function fakeSession() {
  const said: string[] = [];
  let speaking = false;
  let overlapped = false;
  const say = vi.fn((text: string, _options?: Readonly<{ allowInterruptions?: boolean }>) => {
    if (speaking) overlapped = true;
    speaking = true;
    said.push(text);
    return {
      waitForPlayout: async () => {
        await Promise.resolve();
        speaking = false;
      },
    };
  });
  return { said, say, overlapped: () => overlapped };
}

function player(session: ReturnType<typeof fakeSession>, count = 8) {
  const reported: BridgeMetric[] = [];
  const errors: unknown[] = [];
  const instance = createBridgePlayer({
    session: session as unknown as Pick<AriaAgentSession, 'say'>,
    band: 'middle',
    clips: clips(count),
    seed: 5,
    report: (metric) => reported.push(metric),
    onError: (error) => errors.push(error),
  });
  return { instance, reported, errors };
}

describe('bridge player', () => {
  it('plays a recorded clip in the session voice and reports what it played', async () => {
    const session = fakeSession();
    const { instance, reported } = player(session);

    instance.cover({
      intent: 'ANSWER',
      afterMoveKind: 'ASK',
      expectedFirstAudioMs: 1_400,
      childSpeaking: false,
    });
    await instance.settle();

    expect(session.say).toHaveBeenCalledOnce();
    expect(session.say.mock.calls[0]?.[1]).toMatchObject({ allowInterruptions: true });
    expect(reported).toEqual([
      { kind: 'bridge', played: true, bucket: 'acknowledge', rule: null, repeat: false },
    ]);
  });

  it('never leaves two utterances overlapping, whatever the turn order', async () => {
    const session = fakeSession();
    const { instance } = player(session);

    for (let turn = 0; turn < 6; turn += 1) {
      instance.cover({
        intent: 'ANSWER',
        afterMoveKind: 'ASK',
        expectedFirstAudioMs: 1_400,
        childSpeaking: false,
      });
      await instance.settle();
    }

    expect(session.overlapped()).toBe(false);
  });

  it('says nothing and names the rule when the rules refuse', () => {
    const session = fakeSession();
    const { instance, reported } = player(session);

    instance.cover({
      intent: 'ANSWER',
      afterMoveKind: 'ASK',
      expectedFirstAudioMs: 100,
      childSpeaking: false,
    });

    expect(session.say).not.toHaveBeenCalled();
    expect(reported).toEqual([
      { kind: 'bridge', played: false, bucket: null, rule: 'segment-imminent', repeat: false },
    ]);
  });

  it('reports a clip that will not play and lets the answer through anyway', async () => {
    const session = fakeSession();
    session.say.mockImplementationOnce(() => {
      throw new Error('the speaker is gone');
    });
    const { instance, errors } = player(session);

    instance.cover({
      intent: 'ANSWER',
      afterMoveKind: 'ASK',
      expectedFirstAudioMs: 1_400,
      childSpeaking: false,
    });

    await expect(instance.settle()).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  it('never plays two turns running', async () => {
    const session = fakeSession();
    const { instance, reported } = player(session);
    const turn = {
      intent: 'ANSWER' as const,
      afterMoveKind: 'ASK' as const,
      expectedFirstAudioMs: 1_400,
      childSpeaking: false,
    };

    instance.cover(turn);
    await instance.settle();
    instance.cover(turn);

    expect(session.say).toHaveBeenCalledOnce();
    expect(reported.at(-1)).toMatchObject({ played: false, rule: 'back-to-back' });
  });
});
