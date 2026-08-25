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
    });
    expect(voiceWorkerStateSchema.parse({ kind: 'SPEECH_FINISHED', acknowledgedSeq: 4 })).toEqual({
      kind: 'SPEECH_FINISHED',
      acknowledgedSeq: 4,
    });
    expect(
      voiceWorkerStateSchema.safeParse({ kind: 'SPEECH_FINISHED', acknowledgedSeq: -1 }).success,
    ).toBe(false);
  });
});
