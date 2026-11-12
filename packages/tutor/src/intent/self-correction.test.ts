import { describe, expect, it } from 'vitest';

import { selfCorrection } from './self-correction';

describe('a child correcting what Aria knows (P3-06)', () => {
  it.each([
    ["I don't like trucks anymore", { kind: 'stopped_liking', thing: 'trucks' }],
    ['i dont like minecraft any more', { kind: 'stopped_liking', thing: 'minecraft' }],
    ["I'm not into dinosaurs now", { kind: 'stopped_liking', thing: 'dinosaurs' }],
    ['I do not love the space stories anymore', { kind: 'stopped_liking', thing: 'space stories' }],
    ['my dog is called Rex now', { kind: 'renamed', relation: 'dog', name: 'rex' }],
    ["My cat's name is Luna now", { kind: 'renamed', relation: 'cat', name: 'luna' }],
    ["I'm in grade 3 now", { kind: 'grade', grade: '3' }],
  ] as const)('reads %j', (text, expected) => {
    expect(selfCorrection(text)).toEqual(expected);
  });

  it.each(["I don't like this question", 'seven', 'I like trucks', 'my dog is called Rex'])(
    'reads nothing in %j',
    (text) => {
      expect(selfCorrection(text)).toBeNull();
    },
  );
});
