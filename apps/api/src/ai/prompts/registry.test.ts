import { describe, expect, it } from 'vitest';

import { promptRegistry } from '@/ai/prompts/registry';
import type { PromptName } from '@/ai/prompts/types';

const EXPECTED_PROMPTS: Readonly<
  Record<PromptName, { tier: 'TEACH' | 'FAST'; version?: string; jsonMode?: boolean }>
> = {
  'classify-intent': { tier: 'FAST' },
  'classify-safety': { tier: 'FAST' },
  explain: { tier: 'TEACH' },
  'grade-short-answer': { tier: 'FAST' },
  hint: { tier: 'FAST' },
  'memory-proposals': { tier: 'TEACH' },
  'plan-move': { tier: 'TEACH' },
  'practice-item': { tier: 'TEACH', version: '1.1.0' },
  respond: { tier: 'TEACH' },
  // P2H-07: the streamed twin returns prose, because JSON cannot be cut at a full stop.
  'respond-stream': { tier: 'TEACH', jsonMode: false },
};
const PROMPT_NAMES = [
  'classify-intent',
  'classify-safety',
  'explain',
  'grade-short-answer',
  'hint',
  'memory-proposals',
  'plan-move',
  'practice-item',
  'respond',
  'respond-stream',
] as const satisfies readonly PromptName[];

describe('promptRegistry', () => {
  it('registers every named prompt with its required tier and version', () => {
    expect(Object.keys(promptRegistry).sort()).toEqual(Object.keys(EXPECTED_PROMPTS).sort());
    for (const name of PROMPT_NAMES) {
      expect(promptRegistry[name]).toMatchObject({
        name,
        tier: EXPECTED_PROMPTS[name].tier,
        version: EXPECTED_PROMPTS[name].version ?? '1.0.0',
        jsonMode: EXPECTED_PROMPTS[name].jsonMode ?? true,
      });
    }
  });

  it('uses strict typed output schemas for every definition', () => {
    expect(
      promptRegistry['classify-safety'].outputSchema.safeParse({ verdict: 'safe' }).success,
    ).toBe(true);
    expect(
      promptRegistry.hint.outputSchema.safeParse({ hint: 'Count on.', extra: true }).success,
    ).toBe(false);
    expect(
      promptRegistry['practice-item'].outputSchema.safeParse({
        prompt: '2 + 2',
        answer: '4',
        options: [
          { id: 'a', text: '3' },
          { id: 'b', text: '4' },
          { id: 'c', text: '5' },
        ],
        answerKey: 'b',
      }).success,
    ).toBe(true);
    expect(
      promptRegistry['grade-short-answer'].outputSchema.safeParse({
        verdict: 'incorrect',
        feedback: 'Try again.',
      }).success,
    ).toBe(true);
    expect(
      promptRegistry.explain.outputSchema.safeParse({ explanation: 'Use groups.' }).success,
    ).toBe(true);
  });
});
