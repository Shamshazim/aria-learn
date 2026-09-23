import { describe, expect, it } from 'vitest';

import { classifyIntent } from './rules';

const KEY = { answerKey: '7' };

describe('intent rules', () => {
  it.each([
    ['7', 'ANSWER'],
    ['seven', 'ANSWER'],
    ['is it seven?', 'ANSWER'],
    ['I think it is 7', 'ANSWER'],
    ['I have a cat', 'CHAT'],
    ['my dog is called Rex', 'CHAT'],
    ['why do we add?', 'QUESTION'],
    ['what is a ten frame', 'QUESTION'],
    ["I don't get it", 'CONFUSED'],
    ['I am confused', 'CONFUSED'],
    ['I want to stop', 'STOP_REQUEST'],
    ["I'm done", 'STOP_REQUEST'],
    ['skip', 'SKIP_REQUEST'],
    ['can I have a different one', 'SKIP_REQUEST'],
    ['I give up', 'SKIP_REQUEST'],
    ['pass', 'SKIP_REQUEST'],
    ["I can't do this", 'CONFUSED'],
    ['8', 'ANSWER'],
  ] as const)('"%s" is %s', (text, intent) => {
    expect(classifyIntent(text, KEY).intent).toBe(intent);
  });

  it('never treats an open response as chat', () => {
    expect(classifyIntent('I saw a big red dog', { answerKey: null }).intent).toBe('ANSWER');
  });
});
