import { describe, expect, it } from 'vitest';

import { decideInterruption, resumeAtSentence } from './interruption';

describe('server interruption confirmation', () => {
  it('cancels only sustained recognized speech and treats acknowledgements as backchannels', () => {
    expect(
      decideInterruption({ generationId: 'g-1', speechDurationMs: 350, transcript: 'wait' }),
    ).toEqual({ kind: 'confirm', generationId: 'g-1' });
    expect(
      decideInterruption({ generationId: 'g-1', speechDurationMs: 500, transcript: 'mm-hm' }),
    ).toEqual({ kind: 'backchannel' });
    expect(
      decideInterruption({ generationId: 'g-1', speechDurationMs: 120, transcript: '' }),
    ).toEqual({ kind: 'restore' });
  });

  it('resumes a false interruption at a sentence boundary with truthful linkage', () => {
    expect(resumeAtSentence({ moveId: 'm-1', sentence: 'Try the ones column.' })).toEqual({
      resumeOf: 'm-1',
      text: 'So — Try the ones column.',
    });
  });
});
