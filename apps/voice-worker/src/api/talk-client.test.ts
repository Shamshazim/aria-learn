import { describe, expect, it, vi } from 'vitest';

import { createTalkClient } from '@/api/talk-client';

function fetcher(body: unknown, status = 200) {
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({ data: body }), { status })),
  );
}

describe('the talk client', () => {
  it('fetches the brief for the connection epoch with the worker token', async () => {
    const fetch = fetcher({
      connectionEpoch: 2,
      student: { firstName: null, grade: '1', band: 'early' },
      subject: 'math',
      skill: null,
      note: null,
      openQuestion: null,
      memory: [],
      minutesLeft: 5,
    });
    const client = createTalkClient({ baseUrl: 'http://api', token: 'tok', fetcher: fetch });

    const brief = await client.brief('s1', 2);

    expect(brief.minutesLeft).toBe(5);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api/api/v1/internal/voice/session/s1/brief?connectionEpoch=2');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
  });

  it('posts what was heard and what was said', async () => {
    const fetch = fetcher({ crisis: null });
    const client = createTalkClient({ baseUrl: 'http://api', token: 'tok', fetcher: fetch });

    await client.heard('s1', { connectionEpoch: 2, text: 'seven' });

    const [, init] = fetch.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ connectionEpoch: 2, text: 'seven' }));
  });

  it('raises on a rejected call instead of guessing', async () => {
    const client = createTalkClient({ baseUrl: 'http://api', token: 'tok', fetcher: fetcher({}, 403) });
    await expect(client.spoken('s1', { connectionEpoch: 2, text: 'hi' })).rejects.toThrow(/403/);
  });
});
