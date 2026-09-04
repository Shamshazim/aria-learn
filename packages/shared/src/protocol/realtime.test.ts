import { describe, expect, it } from 'vitest';

import { voiceClientEventSchema, voiceWorkerStateSchema } from './realtime';

describe('voice client control events', () => {
  it('requires a generation id to stop audio and bounds acknowledgement cursors', () => {
    expect(voiceClientEventSchema.safeParse({ kind: 'STOP' }).success).toBe(false);
    expect(voiceClientEventSchema.parse({ kind: 'STOP', generationId: 'generation-1' })).toEqual({
      kind: 'STOP',
      generationId: 'generation-1',
    });
    expect(voiceClientEventSchema.safeParse({ kind: 'ACK', acknowledgedSeq: -1 }).success).toBe(
      false,
    );
  });

  it('validates the playback cursor reported by the worker', () => {
    expect(voiceWorkerStateSchema.parse({ kind: 'WORKER_READY' })).toEqual({
      kind: 'WORKER_READY',
      talks: false,
    });
    expect(voiceWorkerStateSchema.parse({ kind: 'SPEECH_FINISHED', acknowledgedSeq: 4 })).toEqual({
      kind: 'SPEECH_FINISHED',
      acknowledgedSeq: 4,
    });
    expect(
      voiceWorkerStateSchema.safeParse({ kind: 'SPEECH_FINISHED', acknowledgedSeq: -1 }).success,
    ).toBe(false);
  });

  it('carries what the child did on the screen, and what either side said, for the talking voice', () => {
    expect(
      voiceClientEventSchema.parse({ kind: 'SCREEN_ANSWER', moveId: 'ask-1', text: '470' }),
    ).toEqual({ kind: 'SCREEN_ANSWER', moveId: 'ask-1', text: '470' });
    expect(voiceClientEventSchema.safeParse({ kind: 'SCREEN_ANSWER', moveId: 'ask-1', text: '' }).success).toBe(false);
    expect(voiceWorkerStateSchema.parse({ kind: 'WORKER_READY', talks: true })).toEqual({
      kind: 'WORKER_READY',
      talks: true,
    });
    expect(voiceWorkerStateSchema.parse({ kind: 'CAPTION', text: 'Nice.' })).toEqual({
      kind: 'CAPTION',
      text: 'Nice.',
    });
    expect(voiceWorkerStateSchema.parse({ kind: 'HEARD', text: 'seven' }).kind).toBe('HEARD');
    expect(voiceClientEventSchema.parse({ kind: 'LEAVE' })).toEqual({ kind: 'LEAVE' });
  });
});
