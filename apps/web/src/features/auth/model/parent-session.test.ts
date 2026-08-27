import { describe, expect, it, vi } from 'vitest';

import type { ParentTokens } from '@/features/auth/api/supabase.api';
import { createParentSessionStore, isUsable } from '@/features/auth/model/parent-session';

const NOW = new Date('2026-08-25T10:00:00.000Z');

const TOKENS: ParentTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: NOW.getTime() + 3_600_000,
};

/** A `Storage` a test owns, so nothing here depends on jsdom's shared one. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    },
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('remembering the parent', () => {
  it('writes and reads the same tokens back', () => {
    const store = createParentSessionStore(memoryStorage());

    store.write(TOKENS);

    expect(store.read()).toEqual(TOKENS);
  });

  it('forgets them on request', () => {
    const store = createParentSessionStore(memoryStorage());
    store.write(TOKENS);

    store.clear();

    expect(store.read()).toBeNull();
  });

  /** A half-written record from an interrupted write is not a session. */
  it('throws away anything that does not parse, rather than trusting it', () => {
    const storage = memoryStorage({ 'aria.parent.session': '{"accessToken":"only"}' });
    const store = createParentSessionStore(storage);

    expect(store.read()).toBeNull();
    expect(storage.getItem('aria.parent.session')).toBeNull();
  });

  it('survives a browser that refuses to store anything at all', () => {
    const refuse = (): never => {
      throw new Error('storage is disabled');
    };
    const throwing: Storage = {
      length: 0,
      clear: refuse,
      key: () => null,
      removeItem: refuse,
      getItem: vi.fn(refuse),
      setItem: vi.fn(refuse),
    };
    const store = createParentSessionStore(throwing);

    expect(() => {
      store.write(TOKENS);
    }).not.toThrow();
    expect(store.read()).toBeNull();
  });
});

describe('whether a remembered token is still worth using', () => {
  it('keeps one with time left and drops one about to expire', () => {
    expect(isUsable(TOKENS, NOW)).toBe(true);
    expect(isUsable({ ...TOKENS, expiresAt: NOW.getTime() + 30_000 }, NOW)).toBe(false);
    expect(isUsable({ ...TOKENS, expiresAt: NOW.getTime() - 1 }, NOW)).toBe(false);
  });
});
