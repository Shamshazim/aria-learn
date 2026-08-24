import { describe, expect, it, vi } from 'vitest';

import type { LlmProvider, StreamChunk } from '@/ai/provider';
import {
  createGatedStreamer,
  MovePlanValidationError,
  SEGMENT_GATE_BUDGET_MS,
  SentenceSegmenter,
  type GatedStreamInput,
} from '@/ai/streaming';
import { createQualityGate } from '@/quality';

const PLAN = {
  moveKind: 'SAY',
  band: 'early',
  answerJudgement: 'not-applicable',
  teachingClaim: 'One and one make two.',
  responseType: 'none',
} as const;

const REQUEST = { tier: 'FAST', system: 'system', user: 'user' } as const;

function input(overrides: Partial<GatedStreamInput> = {}): GatedStreamInput {
  return {
    plan: PLAN,
    request: REQUEST,
    contentKind: 'explanation',
    gateInput: (text) => ({
      id: 'segment',
      kind: 'text',
      band: 'early',
      childText: text,
      factual: false,
      grounding: 'reviewed-bank',
    }),
    fallbackText: 'We can add.',
    ...overrides,
  };
}

function provider(
  chunks: readonly string[],
  onFinally?: () => void,
  onStart?: (signal: AbortSignal | undefined) => void,
): LlmProvider {
  return {
    complete: () => Promise.reject(new Error('Completion is not used')),
    stream: async function* (request) {
      onStart?.(request.signal);
      try {
        for (const text of chunks) {
          if (request.signal?.aborted === true) return;
          yield await Promise.resolve({ kind: 'text', text } satisfies StreamChunk);
        }
      } finally {
        onFinally?.();
      }
    },
  };
}

function gate(unsafeWord?: string) {
  return createQualityGate((text) => ({
    safe: unsafeWord === undefined || !text.toLowerCase().includes(unsafeWord),
    categories: ['test'],
  }));
}

async function collect(stream: AsyncIterable<unknown>): Promise<readonly unknown[]> {
  const values: unknown[] = [];
  for await (const value of stream) values.push(value);
  return values;
}

describe('gated streaming', () => {
  it('never releases raw streamed tokens to a child-facing consumer', async () => {
    const now = vi
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(10);
    const streamer = createGatedStreamer({
      provider: provider(['One and one ', 'make two. What is next?']),
      gate: gate(),
      now,
    });

    const released = await collect(streamer.stream(input()));

    expect(released).toEqual([
      { written: 'One and one make two.', spoken: 'One and one make two.', gateMs: 5 },
      { written: 'What is next?', spoken: 'What is next?', gateMs: 5 },
    ]);
    expect(released).not.toContain('One and one ');
    expect(released.every((value) => typeof value === 'object')).toBe(true);
    expect(5).toBeLessThanOrEqual(SEGMENT_GATE_BUDGET_MS);
  });

  it('aborts a failing segment and releases only a gated fallback after prior sentences', async () => {
    const streamer = createGatedStreamer({
      provider: provider(['One and one make two. Dog.']),
      gate: gate('dog'),
      now: () => 0,
    });

    await expect(collect(streamer.stream(input()))).resolves.toEqual([
      { written: 'One and one make two.', spoken: 'One and one make two.', gateMs: 0 },
      { written: 'We can add.', spoken: 'We can add.', gateMs: 0 },
    ]);
  });

  it.each(['multiple-choice', 'arithmetic', 'decodable-passage', 'unknown-kind'])(
    'buffers %s content until the whole item passes',
    async (contentKind) => {
      const streamer = createGatedStreamer({
        provider: provider(['One and ', 'one make two.']),
        gate: gate(),
        now: () => 0,
      });

      await expect(collect(streamer.stream(input({ contentKind })))).resolves.toEqual([
        { written: 'One and one make two.', spoken: 'One and one make two.', gateMs: 0 },
      ]);
    },
  );

  it('validates the whole move before invoking the provider or segmenter', async () => {
    const baseProvider = provider([]);
    const stream = vi.fn((request: Parameters<LlmProvider['stream']>[0]) =>
      baseProvider.stream(request),
    );
    const push = vi.spyOn(SentenceSegmenter.prototype, 'push');
    const streamer = createGatedStreamer({
      provider: { ...provider([]), stream },
      gate: gate(),
      now: () => 0,
    });
    const invalid = input({ plan: { ...PLAN, responseType: 'text' } });

    await expect(collect(streamer.stream(invalid))).rejects.toBeInstanceOf(MovePlanValidationError);
    expect(stream).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('aborts the vendor request when the consumer stops early', async () => {
    const finished = vi.fn();
    let vendorSignal: AbortSignal | undefined;
    const streamer = createGatedStreamer({
      provider: provider(['One.', 'Two.'], finished, (signal) => {
        vendorSignal = signal;
      }),
      gate: gate(),
      now: () => 0,
    });
    const iterator = streamer.stream(input())[Symbol.asyncIterator]();

    await iterator.next();
    await iterator.return?.();

    expect(finished).toHaveBeenCalledTimes(1);
    expect(vendorSignal?.aborted).toBe(true);
  });
});
