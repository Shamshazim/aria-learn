import { withTransaction } from '@/db';
import type { AdultIdentityRepository } from '@/repositories/adult-identity.repository';
import type { ParentRepository } from '@/repositories/parent.repository';
import type { AdultIdentity, AdultRole, IdentityProviderName } from '@/types/identity';

import type { Pool } from 'pg';

/**
 * Creating the Aria rows behind a first sign-in.
 *
 * Separated from `adult-auth.service.ts` because it is the only part of authentication that
 * writes two tables and therefore needs a transaction: a parent account and its identity link
 * are one fact, and a crash between them would leave an adult who can authenticate but owns
 * nothing. Keeping it here leaves the auth service free of `Pool` and readable as a policy.
 */
export type ProvisionAdultInput = Readonly<{
  provider: IdentityProviderName;
  subject: string;
  email: string;
  role: AdultRole;
  displayName?: string;
  at: Date;
}>;

export type AdultProvisioning = (input: ProvisionAdultInput) => Promise<AdultIdentity>;

export type AdultProvisioningDeps = Readonly<{
  pool: Pool;
  identities: AdultIdentityRepository;
  parents: ParentRepository;
}>;

/**
 * The account name, when the adult has not chosen one yet.
 *
 * The local part of their own email is the least surprising placeholder and is data they
 * already gave us. It is never sent anywhere: `parent.display_name` is Aria-side, and the
 * provider is told nothing but the address it already had.
 */
function defaultDisplayName(email: string): string {
  const local = email.split('@')[0]?.trim();
  return local !== undefined && local.length > 0 ? local : 'Parent';
}

export function createAdultProvisioning(deps: AdultProvisioningDeps): AdultProvisioning {
  const { pool, identities, parents } = deps;

  return (input) =>
    withTransaction(pool, async (tx) => {
      const scopedIdentities = identities.withDb(tx);

      // A teacher owns no children, so there is no parent row to create and no `parent_id` to
      // set. The CHECK constraint on `adult_identity` holds the same rule in the schema.
      if (input.role === 'teacher') {
        return scopedIdentities.insert({
          role: 'teacher',
          provider: input.provider,
          providerSubject: input.subject,
          parentId: null,
          attestedAdultAt: input.at,
        });
      }

      const parent = await parents.withDb(tx).insert({
        email: input.email,
        displayName: input.displayName ?? defaultDisplayName(input.email),
      });

      return scopedIdentities.insert({
        role: 'parent',
        provider: input.provider,
        providerSubject: input.subject,
        parentId: parent.id,
        attestedAdultAt: input.at,
      });
    });
}
