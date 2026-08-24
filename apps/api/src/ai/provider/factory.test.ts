import { describe, expect, it } from 'vitest';

import type { AiConfig } from '@/ai/provider/config.schema';
import { createEndpointProviders } from '@/ai/provider/factory';

describe('endpoint provider factory', () => {
  it('constructs each routed endpoint once and leaves unreferenced endpoints inert', () => {
    const providers = createEndpointProviders(config(), {
      fetch: () => Promise.reject(new Error('Network is not called during construction')),
      now: () => 0,
    });

    expect([...providers.keys()]).toEqual(['anthropic-primary', 'openai-fallback']);
  });
});

function config(): AiConfig {
  const shared = {
    'api-key': 'test-key',
    model: 'test-model',
    'max-tokens': 100,
    'timeout-seconds': 1,
    'cost-per-mtok-in': 1,
    'cost-per-mtok-out': 1,
  };
  return {
    app: {
      ai: {
        routing: {
          TEACH: { endpoint: 'anthropic-primary', fallback: 'openai-fallback' },
          FAST: { endpoint: 'anthropic-primary' },
        },
        endpoints: {
          'anthropic-primary': {
            ...shared,
            api: 'anthropic',
            'base-url': 'https://anthropic.invalid',
          },
          'openai-fallback': {
            ...shared,
            api: 'openai',
            'base-url': 'https://openai.invalid/v1',
          },
          dormant: {
            ...shared,
            api: 'openai',
            'base-url': 'https://dormant.invalid/v1',
          },
        },
      },
    },
  };
}
