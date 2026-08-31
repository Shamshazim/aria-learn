import { z } from 'zod';

import type { AuthConfig } from '@/config';
import { ServiceUnavailableError } from '@/errors';

/**
 * Deleting a parent's account at the identity provider (P0-28).
 *
 * A port, because "delete means delete" has to be testable without a Supabase project, and
 * because the promise is about the *behaviour* — the vendor no longer holds this person —
 * rather than about which vendor. The deletion ledger drives it and retries it.
 *
 * It has exactly one method on purpose. Everything else about a parent is read from the JWT
 * they present; a directory that could also *list* users would be an interface through which
 * a bug could enumerate every family we have.
 */
export type ProviderDirectory = Readonly<{
  /**
   * Delete this provider user. Idempotent: a subject that is already gone is a success, not
   * an error, because the replay must be able to run twice without the second run failing.
   */
  deleteUser(subject: string): Promise<void>;
}>;

/** Config the admin API needs beyond what verifying a token needs. */
export type ProviderDirectoryConfig = Readonly<{
  auth: AuthConfig;
  /** Never logged, never returned, and read only here. */
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}>;

const DEFAULT_TIMEOUT_MS = 10_000;

/** Supabase answers with a JSON body on failure. Only the message is ever worth reading. */
const errorSchema = z.object({ msg: z.string().optional(), message: z.string().optional() });

export function createSupabaseDirectory(config: ProviderDirectoryConfig): ProviderDirectory {
  const fetcher = config.fetch ?? globalThis.fetch;

  return {
    deleteUser: async (subject) => {
      const response = await call(fetcher, config, subject);

      // 404 is success. The point of this call is that the user does not exist afterwards,
      // and a user who never existed satisfies that as well as one we just removed.
      if (response.ok || response.status === 404) return;

      throw new ServiceUnavailableError(
        `identity provider refused to delete a user: HTTP ${String(response.status)} ${await reason(response)}`,
      );
    },
  };
}

async function call(
  fetcher: typeof globalThis.fetch,
  config: ProviderDirectoryConfig,
  subject: string,
): Promise<Response> {
  const url = `${config.auth.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(subject)}`;

  try {
    return await fetcher(url, {
      method: 'DELETE',
      headers: {
        // The service role key goes in both, which is what Supabase's admin API expects.
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    // A network failure is not a deletion. Saying so leaves the ledger row unfinished, which
    // is precisely what makes the replay pick it up again.
    throw new ServiceUnavailableError('identity provider was unreachable', error);
  }
}

/** The vendor's own words, when they are safe to keep. Never the body: it can carry an email. */
async function reason(response: Response): Promise<string> {
  try {
    const parsed = errorSchema.safeParse(await response.json());
    if (!parsed.success) return '';
    const message = parsed.data.msg ?? parsed.data.message ?? '';
    return message.length > 200 ? '' : message;
  } catch {
    return '';
  }
}

/** In-memory, for tests and for a deployment with no service-role key configured. */
export function createRecordingDirectory(): ProviderDirectory & Readonly<{ deleted: string[] }> {
  const deleted: string[] = [];
  return { deleted, deleteUser: (subject) => (deleted.push(subject), Promise.resolve()) };
}
