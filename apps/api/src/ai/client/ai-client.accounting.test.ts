import { describe, expect, it, vi } from 'vitest';

import { createAiClient, type AiClientDependencies } from '@/ai';
import { scrubLearnerContext } from '@/privacy';

type Provider = AiClientDependencies['provider'];
type Accounting = AiClientDependencies['accounting'];

const RESPONSE = {
  text: JSON.stringify({ explanation: 'Three groups of four make twelve.' }),
  endpointName: 'teach-primary',
  model: 'teacher-model',
  tokensIn: 20,
  tokensOut: 8,
  costUsd: 0.001,
  latencyMs: 25,
  finishReason: 'stop',
} as const;

function accounting(): Accounting {
  return {
    assertWithinCap: vi.fn(() => Promise.resolve()),
    record: vi.fn(() => Promise.resolve()),
    recordCachedHit: vi.fn(() => Promise.resolve()),
  };
}

function provider(complete: Provider['complete']): Provider {
  return {
    complete,
    stream: async function* () {
      yield await Promise.resolve({ kind: 'complete', response: RESPONSE } as const);
    },
  };
}

const INPUT = {
  context: scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' }),
  concept: 'multiplication',
  learnerQuestion: 'Why is it twelve?',
  approach: 'visual-model',
};

describe('AiClient cost accounting', () => {
  it('records exactly one privacy-safe row for a successful provider call', async () => {
    const ledger = accounting();
    const client = createAiClient({
      provider: provider(vi.fn(() => Promise.resolve(RESPONSE))),
      accounting: ledger,
      now: () => 100,
    });

    await client.run('explain', INPUT, { studentId: 'student-1' });

    expect(ledger.record).toHaveBeenCalledTimes(1);
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-1', ok: true, costUsd: 0.001 }),
    );
    const serialised = JSON.stringify(vi.mocked(ledger.record).mock.calls);
    expect(serialised).not.toContain(INPUT.learnerQuestion);
    expect(serialised).not.toContain(RESPONSE.text);
  });

  it('records exactly one failed row when the provider rejects', async () => {
    const ledger = accounting();
    const failure = new Error('safe test failure');
    const client = createAiClient({
      provider: provider(vi.fn(() => Promise.reject(failure))),
      accounting: ledger,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125),
    });

    await expect(client.run('explain', INPUT, { studentId: 'student-1' })).rejects.toBe(failure);
    expect(ledger.record).toHaveBeenCalledTimes(1);
    expect(ledger.record).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-1', ok: false, latencyMs: 25 }),
    );
  });
});
