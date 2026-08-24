import { describe, expect, it, vi } from 'vitest';

import type { AiAccounting } from '@/ai/cost';
import { configWithRoutes, fakeProvider } from '@/ai/provider/__fixtures__/routing.fixtures';
import {
  EndpointHealthError,
  createEndpointHealthMonitor,
  probeRoutedEndpoints,
} from '@/ai/provider/health';

function accounting(records: unknown[]): AiAccounting {
  return {
    assertWithinCap: () => Promise.resolve(),
    record: (entry) => {
      records.push(entry);
      return Promise.resolve();
    },
    recordCachedHit: () => Promise.resolve(),
  };
}

describe('probeRoutedEndpoints', () => {
  it('probes every referenced endpoint once, records cost and skips unreferenced endpoints', async () => {
    const calls: string[] = [];
    const records: unknown[] = [];
    const config = configWithRoutes('teach-endpoint', 'fast-endpoint', 'fast-endpoint');
    const configuredEndpoint = config.app.ai.endpoints['teach-endpoint'];
    if (configuredEndpoint === undefined) throw new Error('Fixture endpoint is missing');
    config.app.ai.endpoints.unused = configuredEndpoint;
    const monitor = createEndpointHealthMonitor();

    await probeRoutedEndpoints({
      config,
      providers: new Map([
        ['teach-endpoint', fakeProvider('teach-endpoint', calls)],
        ['fast-endpoint', fakeProvider('fast-endpoint', calls)],
      ]),
      accounting: accounting(records),
      monitor,
      now: vi
        .fn()
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(12)
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(23),
      logger: { info: vi.fn(), warn: vi.fn() },
      isProduction: false,
    });

    expect(calls).toEqual(['teach-endpoint', 'fast-endpoint']);
    expect(records).toHaveLength(2);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ promptName: 'startup-health', ok: true, tokensOut: 1 }),
      ]),
    );
    expect(monitor.get('teach-endpoint')).toEqual({ reachable: true, lastProbeLatencyMs: 2 });
  });

  it('warns and continues in development but fails after all probes in production', async () => {
    const config = configWithRoutes('teach-endpoint', 'fast-endpoint');
    const dead = {
      ...fakeProvider('teach-endpoint', []),
      complete: () => Promise.reject(new Error('secret-key')),
    };
    const logger = { info: vi.fn(), warn: vi.fn() };
    const input = {
      config,
      providers: new Map([
        ['teach-endpoint', dead],
        ['fast-endpoint', fakeProvider('fast-endpoint', [])],
      ]),
      accounting: accounting([]),
      monitor: createEndpointHealthMonitor(),
      now: () => 10,
      logger,
    };

    await expect(probeRoutedEndpoints({ ...input, isProduction: false })).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ endpointName: 'teach-endpoint', reachable: false }),
      expect.any(String),
    );
    await expect(
      probeRoutedEndpoints({
        ...input,
        monitor: createEndpointHealthMonitor(),
        isProduction: true,
      }),
    ).rejects.toEqual(new EndpointHealthError(['teach-endpoint']));
  });
});
