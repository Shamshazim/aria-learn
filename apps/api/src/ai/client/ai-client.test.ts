import { describe, expect, it, vi } from 'vitest';

import {
  AiPromptParseError,
  createAiClient,
  UnscrubbedLearnerContextError,
  type AiClientDependencies,
} from '@/ai';
import { scrubLearnerContext } from '@/privacy';

type Provider = AiClientDependencies['provider'];
type Complete = Provider['complete'];
type LlmRequest = Parameters<Complete>[0];
type LlmResponse = Awaited<ReturnType<Complete>>;

const RESPONSE: LlmResponse = {
  text: JSON.stringify({ explanation: 'Three groups of four make twelve.' }),
  endpointName: 'teach-primary',
  model: 'teacher-model',
  tokensIn: 20,
  tokensOut: 8,
  costUsd: 0.001,
  latencyMs: 25,
  finishReason: 'stop',
};

function createProvider(complete: (request: LlmRequest) => Promise<LlmResponse>): Provider {
  return {
    complete,
    stream: async function* () {
      yield await Promise.resolve({ kind: 'complete', response: RESPONSE } as const);
    },
  };
}

describe('AiClient generation', () => {
  it('runs a named prompt and returns parsed data with traceable metadata', async () => {
    const complete = vi.fn().mockResolvedValue(RESPONSE);
    const client = createAiClient({ provider: createProvider(complete) });
    const signal = new AbortController().signal;
    const context = scrubLearnerContext(
      { identifiers: {}, gradeBand: 'Grade 3', skill: 'multiply within 100' },
      { pseudonym: 'omit' },
    );

    const result = await client.run(
      'explain',
      { context, concept: '3 × 4', learnerQuestion: 'Why is it twelve?' },
      { signal, timeoutMs: 1_500 },
    );

    expect(result.data).toEqual({ explanation: 'Three groups of four make twelve.' });
    expect(result.metadata).toEqual({
      ...RESPONSE,
      promptName: 'explain',
      promptVersion: '1.0.0',
    });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'TEACH',
        maxTokens: 500,
        jsonMode: true,
        signal,
        timeoutMs: 1_500,
      }),
    );
  });
});

describe('AiClient rejection', () => {
  it('rejects malformed model output without returning partial data', async () => {
    const malformed = { ...RESPONSE, text: JSON.stringify({ explanation: '' }) };
    const client = createAiClient({
      provider: createProvider(vi.fn().mockResolvedValue(malformed)),
    });
    const context = scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' });

    const generation = client.run('explain', {
      context,
      concept: 'fractions',
      learnerQuestion: 'What is one half?',
    });

    await expect(generation).rejects.toMatchObject({
      name: 'AiPromptParseError',
      code: 'SERVICE_UNAVAILABLE',
      promptName: 'explain',
      promptVersion: '1.0.0',
    });
    await expect(generation).rejects.toBeInstanceOf(AiPromptParseError);
  });

  it.each([
    {
      name: 'raw context',
      context: { identifiers: { fullName: 'A Child' }, gradeBand: 'Grade 3' },
    },
    {
      name: 'frozen lookalike',
      context: Object.freeze({
        categories: Object.freeze([]),
        value: Object.freeze({ profile: { fullName: 'A Child' } }),
      }),
    },
  ])('refuses $name before calling the provider', async ({ context }) => {
    const complete = vi.fn().mockResolvedValue(RESPONSE);
    const client = createAiClient({ provider: createProvider(complete) });
    const rawInput = {
      context,
      concept: 'multiplication',
      learnerQuestion: 'Can you help?',
    };

    // @ts-expect-error This runtime test deliberately crosses the typed privacy seam.
    const generation = client.run('explain', rawInput);

    await expect(generation).rejects.toBeInstanceOf(UnscrubbedLearnerContextError);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('AiClient input bounds', () => {
  it.each(['x'.repeat(2_001), `${' '.repeat(2_000)}x`])(
    'rejects an oversized prompt input before calling the provider',
    async (concept) => {
      const complete = vi.fn().mockResolvedValue(RESPONSE);
      const client = createAiClient({ provider: createProvider(complete) });
      const context = scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' });

      const generation = client.run('explain', {
        context,
        concept,
        learnerQuestion: 'Can you help?',
      });

      await expect(generation).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(complete).not.toHaveBeenCalled();
    },
  );

  it.each([0, 1.5, 300_001, Number.POSITIVE_INFINITY])(
    'rejects invalid timeout %s before calling the provider',
    async (timeoutMs) => {
      const complete = vi.fn().mockResolvedValue(RESPONSE);
      const client = createAiClient({ provider: createProvider(complete) });
      const context = scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' });

      const generation = client.run(
        'explain',
        { context, concept: 'fractions', learnerQuestion: 'Can you help?' },
        { timeoutMs },
      );

      await expect(generation).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(complete).not.toHaveBeenCalled();
    },
  );
});

describe('AiClient privacy', () => {
  it('redacts identifiers from learner text before rendering the provider request', async () => {
    const requests: LlmRequest[] = [];
    const complete = vi.fn((request: LlmRequest) => {
      requests.push(request);
      return Promise.resolve(RESPONSE);
    });
    const client = createAiClient({ provider: createProvider(complete) });
    const context = scrubLearnerContext(
      { identifiers: { fullName: 'A Child', parentEmail: 'child@example.com' } },
      { pseudonym: 'omit' },
    );

    await client.run('explain', {
      context,
      concept: 'multiplication',
      learnerQuestion: 'My name is A Child and my email is child@example.com.',
    });

    expect(requests[0]?.user).not.toContain('A Child');
    expect(requests[0]?.user).not.toContain('child@example.com');
  });
});
