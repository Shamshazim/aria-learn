import { z } from 'zod';

import type { ParentTokens } from '@/features/auth/api/supabase.api';

/**
 * Where the parent's tokens live between page loads (P2H-12).
 *
 * `localStorage`, and only the parent's. A child's session is an http-only cookie precisely so
 * that no script can reach it; the parent's token has to be readable by the script that sends
 * it, so the honest thing is to say where it is rather than pretend otherwise.
 *
 * It is cleared on sign-out and whenever it fails to parse — a half-written record from an
 * interrupted write is not a session, and treating it as one is how a device gets stuck.
 */
const STORAGE_KEY = 'aria.parent.session';

const storedSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

export type ParentSessionStore = Readonly<{
  read(): ParentTokens | null;
  write(tokens: ParentTokens): void;
  clear(): void;
}>;

/** Storage is a dependency: a test should not need a browser, and jsdom is not the point. */
export function createParentSessionStore(storage: Storage): ParentSessionStore {
  return {
    read: () => {
      const raw = safely(() => storage.getItem(STORAGE_KEY));
      if (raw === null || raw === undefined) return null;
      const parsed = storedSchema.safeParse(safely((): unknown => JSON.parse(raw)));
      if (!parsed.success) {
        safely(() => {
          storage.removeItem(STORAGE_KEY);
        });
        return null;
      }
      return parsed.data;
    },
    write: (tokens) => {
      safely(() => {
        storage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      });
    },
    clear: () => {
      safely(() => {
        storage.removeItem(STORAGE_KEY);
      });
    },
  };
}

/** A minute of margin, so a token does not expire between the check and the request. */
const CLOCK_MARGIN_MS = 60 * 1_000;

export function isUsable(tokens: ParentTokens, now: Date): boolean {
  return tokens.expiresAt - CLOCK_MARGIN_MS > now.getTime();
}

/**
 * Storage throws in more browsers than people expect — private mode, a full quota, a blocked
 * third-party context. A parent who cannot be remembered can still sign in; a crash on boot
 * is a device that cannot do anything at all.
 */
function safely<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}
