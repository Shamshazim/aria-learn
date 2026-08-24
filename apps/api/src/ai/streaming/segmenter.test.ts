import { describe, expect, it } from 'vitest';

import { SentenceSegmenter } from '@/ai/streaming';

describe('SentenceSegmenter', () => {
  it('does not split abbreviations, decimals, ellipses, or quoted punctuation', () => {
    const segmenter = new SentenceSegmenter();

    expect(segmenter.push('Dr. Lee used 3.5 blocks... Then said, "Go." Next?')).toEqual([
      'Dr. Lee used 3.5 blocks... Then said, "Go."',
      'Next?',
    ]);
    expect(segmenter.flush()).toBeNull();
  });

  it('holds incomplete chunks until a sentence boundary arrives', () => {
    const segmenter = new SentenceSegmenter();

    expect(segmenter.push('One and one ')).toEqual([]);
    expect(segmenter.push('make two. What')).toEqual(['One and one make two.']);
    expect(segmenter.flush()).toBe('What');
  });
});
