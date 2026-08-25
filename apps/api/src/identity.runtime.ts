import type { AppConfig } from '@/config';
import { createAdultAuthControllers } from '@/controllers/adult-auth.controller';
import { createChildAuthControllers } from '@/controllers/child-auth.controller';
import { createParentControllers } from '@/controllers/parent.controller';
import { createIdentityProvider, randomSecrets } from '@/identity';
import type { AdultIdentityProvider, SecretGenerator } from '@/identity';
import type { Fetcher } from '@/identity/provider/supabase.http';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import { createAdultGuard } from '@/middleware/require-adult';
import { createChildGuard } from '@/middleware/require-child';
import { createAdultIdentityRepository } from '@/repositories/adult-identity.repository';
import { createAdultSessionRepository } from '@/repositories/adult-session.repository';
import { createChildSessionRepository } from '@/repositories/child-session.repository';
import { createDeletionRequestRepository } from '@/repositories/deletion-request.repository';
import { createDeviceGrantRepository } from '@/repositories/device-grant.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentCredentialRepository } from '@/repositories/student-credential.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import type { RouterDeps } from '@/routes';
import { createAdultAuthService } from '@/services/identity/adult-auth.service';
import { createAdultProvisioning } from '@/services/identity/adult-provisioning';
import { createChildAuthService } from '@/services/identity/child-auth.service';
import type { ChildAuthService } from '@/services/identity/child-auth.service';
import { createChildProfileService } from '@/services/identity/child-profile.service';
import { createConsentService } from '@/services/identity/consent.service';
import { createDeletionService } from '@/services/identity/deletion.service';
import type { DeletionService } from '@/services/identity/deletion.service';
import { createDeviceGrantService } from '@/services/identity/device-grant.service';

import type { Pool } from 'pg';

/**
 * The identity composition root.
 *
 * A sibling of `app.ts` rather than something inside `services/`, for the same reason
 * `phase1/runtime.ts` is: it is the one place allowed to know about every layer at once, and
 * keeping it out of `services/` is what stops a service from acquiring a hidden global graph
 * (CODE-STANDARDS §4).
 *
 * It returns two things: the routers' dependencies, and the pieces the process itself needs —
 * the child-session resolver that the tutoring routes authenticate with, and the deletion
 * service the replay CLI drives.
 */
export type IdentityRuntimeDeps = Readonly<{
  pool: Pool;
  config: AppConfig;
  ids: IdGenerator;
  clock: Clock;
  logger: Logger;
  fetch: Fetcher;
  /** Injected so a test can make device secrets and session tokens predictable. */
  secrets?: SecretGenerator;
  /** Injected by tests that drive the fake provider directly. */
  provider?: AdultIdentityProvider;
}>;

export type IdentityRuntime = Readonly<{
  router: NonNullable<RouterDeps['identity']>;
  childAuth: ChildAuthService;
  deletion: DeletionService;
  provider: AdultIdentityProvider;
}>;

export function createIdentityRuntime(deps: IdentityRuntimeDeps): IdentityRuntime {
  const { pool, config, ids, clock } = deps;
  const secrets = deps.secrets ?? randomSecrets;
  const provider =
    deps.provider ?? createIdentityProvider({ config: config.identity, fetch: deps.fetch, clock });

  const repositories = buildRepositories(pool, ids);
  const services = buildServices({ deps, provider, secrets, repositories });

  return {
    childAuth: services.childAuth,
    deletion: services.deletion,
    provider,
    router: {
      adultAuth: createAdultAuthControllers({
        auth: services.adultAuth,
        provider,
        magicLinkRedirect: config.identity.magicLinkRedirect,
      }),
      parent: createParentControllers({
        consent: services.consent,
        children: services.children,
        devices: services.devices,
        deletion: services.deletion,
      }),
      childAuth: createChildAuthControllers(services.childAuth),
      adultGuard: createAdultGuard(services.adultAuth),
      childGuard: createChildGuard(services.childAuth),
    },
  };
}

type IdentityRepositories = ReturnType<typeof buildRepositories>;

function buildRepositories(pool: Pool, ids: IdGenerator) {
  return {
    identities: createAdultIdentityRepository({ db: pool, ids }),
    adultSessions: createAdultSessionRepository({ db: pool, ids }),
    parents: createParentRepository({ db: pool, ids }),
    students: createStudentRepository({ db: pool, ids }),
    credentials: createStudentCredentialRepository({ db: pool }),
    grants: createDeviceGrantRepository({ db: pool, ids }),
    childSessions: createChildSessionRepository({ db: pool, ids }),
    deletions: createDeletionRequestRepository({ db: pool, ids }),
  } as const;
}

function buildServices(input: {
  deps: IdentityRuntimeDeps;
  provider: AdultIdentityProvider;
  secrets: SecretGenerator;
  repositories: IdentityRepositories;
}) {
  const { deps, provider, secrets, repositories } = input;
  const { pool, clock, logger } = deps;

  const consent = createConsentService({ identities: repositories.identities });

  return {
    adultAuth: createAdultAuthService({
      provider,
      identities: repositories.identities,
      sessions: repositories.adultSessions,
      provisioning: createAdultProvisioning({
        pool,
        identities: repositories.identities,
        parents: repositories.parents,
      }),
      clock,
    }),
    consent,
    children: createChildProfileService({
      students: repositories.students,
      credentials: repositories.credentials,
      childSessions: repositories.childSessions,
      deletions: repositories.deletions,
      consent,
      clock,
    }),
    devices: createDeviceGrantService({
      grants: repositories.grants,
      students: repositories.students,
      childSessions: repositories.childSessions,
      secrets,
      clock,
    }),
    childAuth: createChildAuthService({
      grants: repositories.grants,
      credentials: repositories.credentials,
      sessions: repositories.childSessions,
      secrets,
      clock,
    }),
    deletion: createDeletionService({
      provider,
      identities: repositories.identities,
      adultSessions: repositories.adultSessions,
      grants: repositories.grants,
      parents: repositories.parents,
      students: repositories.students,
      deletions: repositories.deletions,
      clock,
      logger,
    }),
  } as const;
}
