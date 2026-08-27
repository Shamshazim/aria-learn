import { describe, expect, it } from 'vitest';

import { assessOralReading } from './reading';

const timings = (values: readonly Readonly<{ text: string; confidence: number }>[]) =>
  values.map((word, index) => ({ ...word, startMs: index * 500, endMs: index * 500 + 400 }));

describe('oral reading assessment', () => {
  it('aligns substitutions and omissions and reports WCPM as an estimate', () => {
    const result = assessOralReading({
      passage: 'the red cat sat',
      words: timings([
        { text: 'the', confidence: 0.98 },
        { text: 'blue', confidence: 0.95 },
        { text: 'sat', confidence: 0.97 },
      ]),
      onTaskMs: 30_000,
      speaker: 'expected',
    });
    expect(result.wordsCorrect).toBe(2);
    expect(result.wcpm).toBe(4);
    expect(result.aligned.filter((word) => word.result === 'substitution')).toHaveLength(1);
    expect(result.aligned.filter((word) => word.result === 'omission')).toHaveLength(1);
    expect(result.confidence.estimate).toBe(4);
  });

  it('never authorizes durable evidence for low confidence or an uncertain speaker', () => {
    const low = assessOralReading({
      passage: 'the cat',
      words: timings([
        { text: 'the', confidence: 0.3 },
        { text: 'cat', confidence: 0.4 },
      ]),
      onTaskMs: 10_000,
      speaker: 'expected',
    });
    const speaker = assessOralReading({
      passage: 'the cat',
      words: timings([
        { text: 'the', confidence: 0.99 },
        { text: 'cat', confidence: 0.99 },
      ]),
      onTaskMs: 10_000,
      speaker: 'uncertain',
    });
    expect(low.confidence.level).toBe('low');
    expect(low.mayCreateDurableEvidence).toBe(false);
    expect(speaker.mayCreateDurableEvidence).toBe(false);
  });

  it('treats missing transcript words as low coverage rather than confident omissions', () => {
    const result = assessOralReading({
      passage: 'one two three four five six seven eight nine ten',
      words: timings([{ text: 'one', confidence: 0.99 }]),
      onTaskMs: 10_000,
      speaker: 'expected',
    });

    expect(result.confidence.level).toBe('low');
    expect(result.mayCreateDurableEvidence).toBe(false);
  });
});
