import type { ParentRepository } from '@/repositories/parent.repository';
import type { ParentActor } from '@/types/auth';

import type { VerifiedParentToken } from './supabase-jwt.verifier';

/**
 * The family a verified token belongs to (P2H-12).
 *
 * A parent row is created on the first authenticated call rather than by a webhook from
 * Supabase. Sign-up and first use are the same moment for a parent, and a webhook we have not
 * received yet would show them an empty child list they cannot fix — the ticket names this as
 * an edge case and this is the answer to it.
 *
 * The Supabase subject is the key, never the email. An address can be changed in the auth
 * provider, and a family whose account survived that change must not become a second family.
 */
export type ParentIdentityService = Readonly<{
  resolve(token: VerifiedParentToken): Promise<ParentActor>;
}>;

/** Shown until a parent sets their own; never spoken to a child. */
const PLACEHOLDER_NAME = 'Parent';

export function createParentIdentityService(deps: {
  parents: Pick<ParentRepository, 'findBySupabaseUserId' | 'insert'>;
}): ParentIdentityService {
  return {
    resolve: async (token) => {
      const existing = await deps.parents.findBySupabaseUserId(token.supabaseUserId);
      if (existing !== null) {
        return { id: existing.id, supabaseUserId: token.supabaseUserId, email: existing.email };
      }
      const created = await deps.parents.insert({
        email: token.email,
        supabaseUserId: token.supabaseUserId,
        displayName: PLACEHOLDER_NAME,
      });
      return { id: created.id, supabaseUserId: token.supabaseUserId, email: created.email };
    },
  };
}
