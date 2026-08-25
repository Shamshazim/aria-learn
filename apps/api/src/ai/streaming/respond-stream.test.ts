import { describe, expect, it, vi } from 'vitest';

import type { AiAccounting } from '@/ai/cost';
import type { LlmProvider, StreamChunk } from '@/ai/provider';
import { createGatedStreamer } from '@/ai/streaming/gated-stream';
import { createRespondStreamer, type RespondStreamInput } from '@/ai/streaming/respond-stream';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate, speakableGate, type GateInput, type QualityGate } from '@/quality';

/** Four sentences, handed over one at a time with a gap the test can measure. */
const FOUR_SENTENCES = [
  'Four plus three is seven. ',
  'You can count on from four. ',
  'Five, six, seven. ',
  'That is the whole idea.',
];

const ACCOUNTING: AiAccounting = {
  assertWithinCap: () => Promise.resolve(),
  record: () => Promise.resolve(),
  recordCachedHit: () => Promise.resolve(),
};

function provider(chunks: readonly string[], delayMs: number): LlmProvider {
  return {
    complete: () => Promise.reject(new Error('Completion is not used')),
    stream: async function* (request) {
      for (const text of chunks) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (request.signal?.aborted === true) return;
        yield { kind: 'text', text } satisfies StreamChunk;
      }
    },
  };
}

function streamer(chunks: readonly string[], delayMs: number, gate: QualityGate) {
  return createRespondStreamer(
    createGatedStreamer({
      provider: provider(chunks, delayMs),
      gate: speakableGate(gate),
      now: () => 0,
      callNow: () => 0,
      accounting: ACCOUNTING,
    }),
  );
}

function input(overrides: Partial<RespondStreamInput> = {}): RespondStreamInput {
  return {
    promptInput: {
      context: scrubLearnerContext({ identifiers: {}, gradeBand: 'middle' }, { pseudonym: 'omit' }),
      band: 'middle',
      move: 'SAY',
      approach: 'answer-question',
      subject: 'math',
    },
    plan: {
      moveKind: 'SAY',
      band: 'middle',
      answerJudgement: 'not-applicable',
      teachingClaim: 'Counting on is addition.',
      responseType: 'none',
    },
    contentKind: 'explanation',
    gateInput: (text) => ({
      id: 'turn-text',
      kind: 'text',
      band: 'middle',
      childText: text,
      factual: false,
      grounding: 'unsupported',
    }),
    fallbackText: 'We can look at it together.',
    ...overrides,
  };
}

function safeGate(): QualityGate {
  return createQualityGate(() => ({ safe: true, categories: [] }));
}

describe('the respond stream', () => {
  it('releases the first sentence before the last one has been generated', async () => {
    const released: number[] = [];
    const startedAt = Date.now();

    for await (const segment of streamer(FOUR_SENTENCES, 20, safeGate()).stream(input())) {
      expect(segment.written).not.toBe('');
      released.push(Date.now() - startedAt);
    }

    expect(released).toHaveLength(4);
    expect(released[0]).toBeLessThan(released.at(-1) ?? 0);
  });

  it('checks every sentence it releases, and releases nothing it did not check', async () => {
    const checked: string[] = [];
    const gate = safeGate();
    const counting = vi.fn((value: GateInput) => {
      checked.push(value.childText);
      return gate(value);
    });

    const released: string[] = [];
    for await (const segment of streamer(FOUR_SENTENCES, 0, counting).stream(input())) {
      released.push(segment.written);
    }

    expect(released).toHaveLength(4);
    expect(checked).toEqual(released);
  });

  it('closes an answer whose sentence fails the gate with a reviewed one', async () => {
    const gate = createQualityGate((text) => ({
      safe: !text.includes('count on'),
      categories: ['test'],
    }));

    const released = [];
    for await (const segment of streamer(FOUR_SENTENCES, 0, gate).stream(input())) {
      released.push(segment);
    }

    expect(released.map((segment) => segment.written)).toEqual([
      'Four plus three is seven.',
      'We can look at it together.',
    ]);
    expect(released.at(-1)?.isLast).toBe(true);
  });

  it('holds the register rule that a sentence can be judged by on its own', async () => {
    const senior = {
      promptInput: { ...input().promptInput, band: 'senior' as const },
      plan: { ...input().plan, band: 'senior' as const },
      gateInput: (text: string) => ({ ...input().gateInput(text), band: 'senior' as const }),
    };

    const released = [];
    for await (const segment of streamer(['Well done! ', 'Keep going.'], 0, safeGate()).stream(
      input(senior),
    )) {
      released.push(segment.written);
    }

    // Senior-band text is calm and adult, so the exclamation never reaches a child (P2H-03).
    expect(released).toEqual(['We can look at it together.']);
  });

  it('emits exactly one segment for content that has to be checked whole', async () => {
    const released = [];
    for await (const segment of streamer(FOUR_SENTENCES, 0, safeGate()).stream(
      input({ contentKind: 'multiple-choice' }),
    )) {
      released.push(segment);
    }

    expect(released).toHaveLength(1);
    expect(released[0]?.isLast).toBe(true);
  });
});
