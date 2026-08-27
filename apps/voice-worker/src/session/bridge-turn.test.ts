import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, tutorMoveSchema } from '@aria/shared';

import type { BridgePlayer } from '@/session/bridge-player';
import { createBridgeTurn } from '@/session/bridge-turn';
import { createFirstAudioEstimate } from '@/session/first-audio-estimate';

const SESSION_ID = sessionIdSchema.parse('11111111-1111-4111-8111-111111111111');

function harness() {
  const cover = vi.fn();
  const player: BridgePlayer = { cover, settle: () => Promise.resolve() };
  return {
    cover,
    turn: createBridgeTurn({ player, estimate: createFirstAudioEstimate(), now: () => 0 }),
  };
}

function move(kind: 'ASK' | 'SWITCH') {
  return tutorMoveSchema.parse({
    id: `move-${kind}`,
    at: '2026-08-25T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind,
    speech: { text: 'Something.' },
    display: [],
    expects: 'none',
    ...(kind === 'SWITCH' ? { skillCode: 'MATH.1.OA.1', reason: 'prerequisite' } : {}),
  });
}

describe('the bridge across one turn', () => {
  it('holds the bridge back when the child started speaking after their transcript', () => {
    const { cover, turn } = harness();

    turn.observeTranscript();
    turn.observeSpeechStarted();
    turn.cover({ text: 'seven' });

    expect(cover.mock.calls[0]?.[0]).toMatchObject({ childSpeaking: true });
  });

  it('does not carry a barge-in from before the transcript into this gap', () => {
    const { cover, turn } = harness();

    // The child talked over the previous answer; that speech ended with this transcript.
    turn.observeSpeechStarted();
    turn.observeTranscript();
    turn.cover({ text: 'seven' });

    expect(cover.mock.calls[0]?.[0]).toMatchObject({ childSpeaking: false });
  });

  it('does not let a false interruption silence every gap that follows it', () => {
    const { cover, turn } = harness();

    turn.observeSpeechStarted();
    turn.observeTranscript();
    turn.cover({ text: 'seven' });
    turn.observeTranscript();
    turn.cover({ text: 'eight' });

    expect(cover.mock.calls[1]?.[0]).toMatchObject({ childSpeaking: false });
  });

  it('classifies the bucket from the child words alone, with no answer key', () => {
    const { cover, turn } = harness();

    turn.observeTranscript();
    turn.cover({ text: 'why does that work?' });

    expect(cover.mock.calls[0]?.[0]).toMatchObject({ intent: 'QUESTION' });
  });

  it('makes the gap after a switch a transition', () => {
    const { cover, turn } = harness();

    turn.observeMove(move('SWITCH'));
    turn.observeTranscript();
    turn.cover({ text: 'okay' });

    expect(cover.mock.calls[0]?.[0]).toMatchObject({ afterMoveKind: 'SWITCH' });
  });
});
