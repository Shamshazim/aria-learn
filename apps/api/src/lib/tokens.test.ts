import { describe, expect, it } from 'vitest';

import { randomTokens, sequentialTokens } from './tokens';

describe('session secrets', () => {
  it('are long, url-safe and never the same twice', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomTokens.next()));

    expect(seen.size).toBe(200);
    for (const token of seen) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    }
  });

  /** The test double is the point of the port: a predictable secret is an assertable one. */
  it('are predictable when a test asks for that instead', () => {
    const tokens = sequentialTokens();

    expect([tokens.next(), tokens.next()]).toEqual(['secret-1', 'secret-2']);
    expect(sequentialTokens('device').next()).toBe('device-1');
  });
});
