import { z } from 'zod';

/**
 * The build-time configuration this app is served with.
 *
 * Parsed rather than read, for the same reason the API parses its environment: a missing
 * Supabase project should be a shape the code can branch on, not `undefined` discovered inside
 * a click handler. `VITE_` keys are public by construction — the anon key is meant to ship — so
 * nothing secret is named here (§8).
 */
const result = z
  .object({
    VITE_API_BASE_URL: z.string().optional(),
    VITE_SUPABASE_URL: z.string().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().optional(),
  })
  .safeParse(import.meta.env);

const env = result.success ? result.data : {};

export type WebConfig = Readonly<{
  apiBaseUrl: string;
  /** Absent means this build cannot sign a parent in; the UI says so rather than failing. */
  supabase: Readonly<{ url: string; anonKey: string }> | undefined;
}>;

export const webConfig: WebConfig = {
  apiBaseUrl: env.VITE_API_BASE_URL ?? '',
  supabase:
    env.VITE_SUPABASE_URL === undefined || env.VITE_SUPABASE_ANON_KEY === undefined
      ? undefined
      : { url: env.VITE_SUPABASE_URL.replace(/\/+$/u, ''), anonKey: env.VITE_SUPABASE_ANON_KEY },
};
