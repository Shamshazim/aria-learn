import { describe, expect, it, vi } from 'vitest';

import { createBridgeClient } from '@/api/bridge-client';

const LIBRARY = {
  band: 'middle',
  voice: 'voice-middle',
  sampleRate: 24_000,
  clips: [
    { id: 'clip-1', bucket: 'thinking', text: 'Let me think.' },
    { id: 'clip-2', bucket: 'not-a-bucket', text: 'Nonsense.' },
  ],
};

function pcm(sampleCount: number): ArrayBuffer {
  return new Int16Array(sampleCount).buffer;
}

function fetcher(
  handlers: Readonly<Record<string, () => Response>>,
): Readonly<{ fetch: typeof fetch; calls: string[] }> {
  const calls: string[] = [];
  const fake: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    const handler = Object.entries(handlers).find(([key]) => url.includes(key))?.[1];
    return Promise.resolve(handler?.() ?? new Response(null, { status: 404 }));
  };
  return { fetch: fake, calls };
}

describe('bridge client', () => {
  it('loads the band library once and turns its audio into frames', async () => {
    const transport = fetcher({
      '/bridges?': () => Response.json({ data: LIBRARY }),
      '/clip-1/audio': () => new Response(pcm(24_000)),
    });
    const onUnavailable = vi.fn();
    const client = createBridgeClient({
      baseUrl: 'https://api.test',
      token: 'worker-token',
      fetcher: transport.fetch,
      onUnavailable,
    });

    const loaded = await client.load({ band: 'middle', voice: 'voice-middle' });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.clip).toMatchObject({ id: 'clip-1', bucket: 'thinking', durationMs: 1_000 });
    // A second of audio at a tenth of a second per frame.
    expect(loaded[0]?.audio).toHaveLength(10);
    expect(transport.calls[0]).toContain('band=middle&voice=voice-middle');
  });

  it('drops a clip whose audio has gone missing rather than failing the session', async () => {
    const transport = fetcher({ '/bridges?': () => Response.json({ data: LIBRARY }) });
    const onUnavailable = vi.fn();
    const client = createBridgeClient({
      baseUrl: 'https://api.test',
      token: 'worker-token',
      fetcher: transport.fetch,
      onUnavailable,
    });

    await expect(client.load({ band: 'middle', voice: 'voice-middle' })).resolves.toEqual([]);
    expect(onUnavailable).toHaveBeenCalledWith('clip-1');
  });

  it('plays no bridges at all when the deployment serves no library', async () => {
    const transport = fetcher({});
    const client = createBridgeClient({
      baseUrl: 'https://api.test',
      token: 'worker-token',
      fetcher: transport.fetch,
      onUnavailable: vi.fn(),
    });

    await expect(client.load({ band: 'early', voice: 'voice-early' })).resolves.toEqual([]);
  });
});
