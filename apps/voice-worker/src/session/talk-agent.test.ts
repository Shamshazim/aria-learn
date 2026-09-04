import { describe, expect, it } from 'vitest';

import { sentencesOf } from '@/session/talk-agent';

async function* chunks(...items: string[]): AsyncIterable<string> {
  for (const item of items) yield await Promise.resolve(item);
}

async function collect(input: AsyncIterable<string>): Promise<string[]> {
  const heard: string[] = [];
  for await (const chunk of sentencesOf(input, (sentence) => heard.push(sentence))) {
    if (typeof chunk !== 'string') throw new Error('expected plain text');
  }
  return heard;
}

describe('the sentence tap on what Aria says', () => {
  it('reports each sentence once it has ended, across chunk boundaries', async () => {
    const heard = await collect(chunks('Nice work, ', 'Sam! You lined', ' the tens up. Now', ' try 374.'));
    expect(heard).toEqual(['Nice work, Sam!', 'You lined the tens up.', 'Now try 374.']);
  });

  it('flushes a trailing sentence without punctuation when the stream ends', async () => {
    expect(await collect(chunks('Ready when you are'))).toEqual(['Ready when you are']);
  });

  it('passes every chunk through untouched', async () => {
    const passed: unknown[] = [];
    for await (const chunk of sentencesOf(chunks('a. ', 'b'), () => undefined)) passed.push(chunk);
    expect(passed).toEqual(['a. ', 'b']);
  });
});
