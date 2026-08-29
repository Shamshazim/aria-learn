import {
  createParentSessionService,
  createSupabaseDirectory,
  type ProviderDirectory,
} from '@/auth';
import { ServiceUnavailableError } from '@/errors';
import { randomTokens } from '@/lib/tokens';
import type { createChildSessionRepository } from '@/repositories/child-session.repository';
import { createConsentRecordRepository } from '@/repositories/consent-record.repository';
import { createDeletionRequestRepository } from '@/repositories/deletion-request.repository';
import { createDeviceGrantRepository } from '@/repositories/device-grant.repository';
import { createParentSessionRepository } from '@/repositories/parent-session.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { createConsentService } from '@/services/parent/consent.service';
import { createDeletionService } from '@/services/parent/deletion.service';
import { createDevicesService } from '@/services/parent/devices.service';

import type { Phase1RuntimeDeps } from './runtime.types';

/**
 * The four capabilities P0-28 adds to a parent's account: consent, devices, a revocable
 * session, and erasure.
 *
 * Built together, in their own module, for two reasons. They share a clock and an id
 * generator; and `children` needs the consent service before it exists, because a child row
 * cannot be written without one.
 */
export type AccessServices = Readonly<{
  consent: ReturnType<typeof createConsentService>;
  devices: ReturnType<typeof createDevicesService>;
  parentSessions: ReturnType<typeof createParentSessionService>;
  deletion: ReturnType<typeof createDeletionService>;
}>;

export function buildAccessServices(input: {
  deps: Phase1RuntimeDeps;
  childSessions: ReturnType<typeof createChildSessionRepository>;
}): AccessServices {
  const { deps } = input;
  const shared = { clock: deps.clock, ids: deps.ids };

  return {
    consent: createConsentService({
      consents: createConsentRecordRepository(deps.pool),
      ...shared,
    }),
    devices: createDevicesService({
      grants: createDeviceGrantRepository(deps.pool),
      sessions: input.childSessions,
      tokens: deps.tokens ?? randomTokens,
      ...shared,
    }),
    parentSessions: createParentSessionService({
      sessions: createParentSessionRepository(deps.pool),
      ...shared,
    }),
    deletion: createDeletionService({
      ledger: createDeletionRequestRepository(deps.pool),
      students: createStudentRepository({ db: deps.pool, ids: deps.ids }),
      parents: createParentRepository({ db: deps.pool, ids: deps.ids }),
      consents: createConsentRecordRepository(deps.pool),
      directory: providerDirectory(deps),
      logger: deps.logger,
      ...shared,
    }),
  };
}

/**
 * Where account deletion reaches the provider, or an honest refusal.
 *
 * A deployment with no service-role key cannot delete a Supabase user. The alternative to
 * failing here would be a directory that quietly does nothing, which would mark every erasure
 * complete while the vendor still held the person — the exact lie this ticket exists to
 * prevent. Failing leaves the debt in the ledger, where it is visible and replayable.
 */
function providerDirectory(deps: Phase1RuntimeDeps): ProviderDirectory {
  const auth = deps.config.auth;
  if (deps.directory !== undefined) return deps.directory;
  if (auth?.serviceRoleKey === undefined) return unconfiguredDirectory;
  return createSupabaseDirectory({ auth, serviceRoleKey: auth.serviceRoleKey });
}

const unconfiguredDirectory: ProviderDirectory = {
  deleteUser: () =>
    Promise.reject(
      new ServiceUnavailableError(
        'SUPABASE_SERVICE_ROLE_KEY is not configured, so a provider user cannot be deleted',
      ),
    ),
};
