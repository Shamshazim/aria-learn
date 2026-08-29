import { ConsentRequiredError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { ConsentRecordRepository } from '@/repositories/consent-record.repository';
import type { ConsentMethod, ConsentRecord } from '@/types/parent-access';

/**
 * Verifiable parental consent (P0-28, master-plan.md §12).
 *
 * COPPA's rule is about *timing* as much as about consent: an operator must obtain it before
 * knowingly collecting anything from a child under thirteen. So this is not a checkbox
 * recorded alongside a child — it is a precondition of the request that creates one, and
 * `requireConsent` is what `addChild` calls before it writes a row.
 *
 * The disclosure version is stored with every grant. A consent that cannot say what was shown
 * is a consent that cannot be audited, and the disclosure is reworded whenever a processor
 * changes (P2H-08 renamed voices inside it).
 */
export type ConsentService = Readonly<{
  grant(
    input: Readonly<{
      parentId: string;
      method: ConsentMethod;
      sourceReference: string | null;
      disclosureVersion: string;
    }>,
  ): Promise<ConsentRecord>;
  /** Every grant, withdrawn ones included. The audit answer, and what the parent app shows. */
  history(parentId: string): Promise<readonly ConsentRecord[]>;
  current(parentId: string): Promise<ConsentRecord | null>;
  /**
   * Throws unless this parent has live consent on file. Called before a child row is created,
   * and it is the whole point of this service.
   */
  requireConsent(parentId: string): Promise<ConsentRecord>;
  /** Withdrawal. The caller decides what else that ends; this only records it. */
  withdraw(parentId: string): Promise<number>;
}>;

export function createConsentService(deps: {
  consents: ConsentRecordRepository;
  clock: Clock;
  ids: IdGenerator;
}): ConsentService {
  const service: ConsentService = {
    grant: async (input) =>
      deps.consents.insert({
        id: deps.ids.next(),
        parentId: input.parentId,
        method: input.method,
        sourceReference: input.sourceReference,
        disclosureVersion: input.disclosureVersion,
        at: deps.clock.now(),
      }),

    history: (parentId) => deps.consents.listByParent(parentId),
    current: (parentId) => deps.consents.findActive(parentId),

    requireConsent: async (parentId) => {
      const consent = await service.current(parentId);
      // 403 and not 401: the parent is signed in and is who they say they are. What is
      // missing is a step they have not taken, and the message says so.
      if (consent === null) {
        throw new ConsentRequiredError(`parent ${parentId} has no verifiable consent on file`);
      }
      return consent;
    },

    withdraw: (parentId) => deps.consents.withdrawAll(parentId, deps.clock.now()),
  };

  return service;
}
