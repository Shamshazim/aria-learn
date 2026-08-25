import { systemClock, type Clock } from '@/lib/clock';

import { createFakeIdentityProvider } from './provider/fake.provider';
import { createHs256Verifier } from './provider/jwt';
import { buildSupabaseProvider } from './provider/supabase.adapter';

import type { IdentityConfig } from './config';
import type { Fetcher } from './provider/supabase.http';
import type { AdultIdentityProvider } from './provider/types';

/**
 * Picks the identity adapter from configuration.
 *
 * A map rather than a chain of ifs, so a second vendor — or the self-hosted GoTrue that
 * rewrite.md §6 keeps as an exit — is a new entry and a new file, not an edit to this
 * function (CODE-STANDARDS §4).
 */
export type IdentityRuntimeDeps = Readonly<{
  config: IdentityConfig;
  fetch: Fetcher;
  clock?: Clock;
}>;

export class IdentityConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityConfigError';
  }
}

const FACTORIES: Readonly<
  Record<IdentityConfig['provider'], (deps: IdentityRuntimeDeps) => AdultIdentityProvider>
> = {
  fake: ({ clock }) => createFakeIdentityProvider(() => (clock ?? systemClock).now()),

  supabase: ({ config, fetch, clock }) => {
    const settings = config.supabase;
    // Unreachable through `loadConfig`, which refuses to produce this pair. Kept because the
    // type cannot say "present when provider is supabase" and a thrown error beats a `!`.
    if (settings === undefined) {
      throw new IdentityConfigError('IDENTITY_PROVIDER=supabase without Supabase settings');
    }

    return buildSupabaseProvider({
      baseUrl: settings.url,
      anonKey: settings.anonKey,
      serviceRoleKey: settings.serviceRoleKey,
      timeoutMs: settings.timeoutMs,
      fetch,
      verifier: createHs256Verifier({
        secret: settings.jwtSecret,
        audience: settings.jwtAudience,
        now: () => (clock ?? systemClock).now(),
        ...(settings.jwtIssuer === undefined ? {} : { issuer: settings.jwtIssuer }),
      }),
    });
  },
};

export function createIdentityProvider(deps: IdentityRuntimeDeps): AdultIdentityProvider {
  return FACTORIES[deps.config.provider](deps);
}
