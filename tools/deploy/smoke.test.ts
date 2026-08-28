import { describe, expect, it } from 'vitest';

import { allPassed, checkApiOrigin, checkHealth, checkVersion, checkWebRoute } from './smoke';

describe('checkHealth', () => {
  it('passes a healthy API', () => {
    expect(checkHealth(200, { status: 'ok' }).ok).toBe(true);
  });

  // A model provider being unreachable is a degraded tutor, not a broken deploy: P0-25 gives
  // a child a real experience for it, and blocking the release would leave the *previous*
  // broken one serving.
  it('passes a degraded API', () => {
    expect(checkHealth(200, { status: 'degraded' }).ok).toBe(true);
  });

  it.each([
    ['a non-200', 503, { status: 'ok' }],
    ['a down report', 200, { status: 'down' }],
    ['an unreadable body', 200, {}],
  ])('fails %s', (_label, status, body) => {
    expect(checkHealth(status, body).ok).toBe(false);
  });
});

describe('checkVersion', () => {
  it('fails when the old release is still serving', () => {
    expect(checkVersion({ version: '1.0.0' }, '1.1.0').ok).toBe(false);
  });

  it('is skipped when nothing was asserted', () => {
    expect(checkVersion({ version: '1.0.0' }, undefined)).toMatchObject({
      ok: true,
      detail: 'not asserted',
    });
  });
});

describe('checkWebRoute', () => {
  it('wants HTML back from a route that is not a file', () => {
    expect(checkWebRoute(200, 'text/html; charset=utf-8').ok).toBe(true);
    expect(checkWebRoute(404, 'text/html').ok).toBe(false);
    expect(checkWebRoute(200, 'application/json').ok).toBe(false);
  });
});

describe('checkApiOrigin', () => {
  const origin = 'https://api.staging.arialearn.example';

  it('finds the origin baked into an asset', () => {
    expect(checkApiOrigin('<html></html>', [`const b="${origin}"`], origin).ok).toBe(true);
  });

  // The failure this exists for: a staging bundle promoted to production. Everything else
  // about that deploy looks perfect.
  it('fails when the bundle points somewhere else', () => {
    expect(checkApiOrigin('<html></html>', ['const b="https://api.staging.x"'], origin).ok).toBe(
      false,
    );
  });
});

describe('allPassed', () => {
  it('is false if a single check failed', () => {
    expect(
      allPassed([
        { name: 'a', ok: true, detail: '' },
        { name: 'b', ok: false, detail: '' },
      ]),
    ).toBe(false);
  });
});
