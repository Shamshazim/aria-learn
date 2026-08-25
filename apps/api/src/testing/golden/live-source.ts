import { z } from 'zod';

import { promptRegistry } from '@/ai/prompts/registry';
import { createNamedEndpointProvider, type AiConfig } from '@/ai/provider';
import { scrubLearnerContext } from '@/privacy';
import type { GoldenSource } from '@/testing/golden/types';

const outputSchema = z
  .object({
    prompt: z.string().min(1),
    answer: z.string().min(1),
    options: z.array(z.object({ id: z.string(), text: z.string() }).strict()).optional(),
    answerKey: z.string().optional(),
  })
  .strict();

export function createLiveGoldenSource(dependencies: {
  config: AiConfig;
  endpointName: string;
  fetch: typeof globalThis.fetch;
  now: () => number;
}): GoldenSource {
  const provider = createNamedEndpointProvider(dependencies.config, dependencies.endpointName, {
    fetch: dependencies.fetch,
    now: dependencies.now,
  });
  const definition = promptRegistry['practice-item'];
  const context = scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' });
  return {
    generate: async (item) => {
      const response = await provider.complete({
        tier: definition.tier,
        system: definition.system,
        user: definition.render({ context, ...item.input }),
        maxTokens: definition.maxTokens,
        jsonMode: definition.jsonMode,
        temperature: 0,
      });
      const input: unknown = JSON.parse(response.text);
      const output = outputSchema.parse(input);
      return { ...output, ...response };
    },
  };
}
