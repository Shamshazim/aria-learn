import { ForbiddenError } from '@/errors';
import type { AdultIdentityRepository } from '@/repositories/adult-identity.repository';
import type { AdultActor, ConsentMethod, ConsentRecord } from '@/types/identity';

/**
 * Verifiable consent, and the gate that depends on it.
 *
 * The FTC requires consent *before* any child data is collected, so this is not a flag on a
 * profile — it is a precondition every child-profile call asks about first. `requireConsent`
 * is the whole enforcement surface, and it is one function so that "did we check?" has one
 * answer rather than one per endpoint.
 *
 * A teacher's consent source is a school's, never their own account: an individual teacher
 * account is not silently treated as parental consent (rewrite.md §6).
 */
export type ConsentService = Readonly<{
  record(input: {
    actor: AdultActor;
    method: ConsentMethod;
    sourceReference: string | null;
  }): Promise<ConsentRecord>;
  list(adultId: string): Promise<readonly ConsentRecord[]>;
  /** Throws unless consent is active. Called before a child profile is created or opened. */
  requireConsent(adultId: string): Promise<void>;
}>;

export type ConsentServiceDeps = Readonly<{
  identities: AdultIdentityRepository;
}>;

export function createConsentService(deps: ConsentServiceDeps): ConsentService {
  const { identities } = deps;

  return {
    record: (input) =>
      identities.recordConsent({
        adultId: input.actor.adultId,
        method: input.method,
        sourceReference: input.sourceReference,
      }),

    list: (adultId) => identities.listConsent(adultId),

    async requireConsent(adultId) {
      if (!(await identities.hasActiveConsent(adultId))) {
        throw new ForbiddenError(`adult ${adultId} has no active consent on record`);
      }
    },
  };
}
