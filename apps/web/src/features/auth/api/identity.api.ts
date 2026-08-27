import { z } from 'zod';

import {
  childListResponseSchema,
  childSessionResponseSchema,
  childSummarySchema,
  type ChildPicture,
  type ChildSessionResponse,
  type ChildSummary,
  type Grade,
} from '@aria/shared';

import { ApiError, type ApiClient } from '@/api';

/**
 * Everything the app asks our own API about who is using it (P2H-12).
 *
 * The parent's bearer token is passed per call rather than baked into a client, because the
 * same client serves the child's routes, and a token that lived on the client would end up
 * attached to a request made from a child's screen.
 */
export type ChildLoginInput = Readonly<{
  childId: string;
  pin?: string;
  pictureSequence?: readonly ChildPicture[];
  deviceLabel?: string;
}>;

export type ChildProfileInput = Readonly<{
  displayName?: string;
  grade?: Grade;
  settings?: Readonly<{
    shareFirstName?: boolean;
    pronunciation?: string | null;
    avatar?: ChildPicture;
  }>;
  login?: Readonly<{
    pin?: string | null;
    pictureSequence?: readonly ChildPicture[] | null;
    familyDevice?: boolean;
  }>;
}>;

export type IdentityApi = Readonly<{
  children(token: string): Promise<readonly ChildSummary[]>;
  /**
   * Ends every child session on the account, on every device. The rule it exists for:
   * "a parent can revoke all child sessions."
   */
  revokeAllSessions(token: string): Promise<number>;
  login(token: string, input: ChildLoginInput): Promise<ChildSessionResponse>;
  logout(): Promise<void>;
  /** Resolves to the live session, or null when this device has none. */
  refresh(): Promise<ChildSessionResponse | null>;
  addChild(
    token: string,
    input: Readonly<{ displayName: string; grade: Grade; avatar?: ChildPicture }>,
  ): Promise<ChildSummary>;
  updateChild(token: string, childId: string, input: ChildProfileInput): Promise<ChildSummary>;
  /**
   * P2-03, granted here for the first time by an adult who actually proved who they are.
   * The reference is what our record will say the verification was.
   */
  grantVoiceConsent(token: string, childId: string): Promise<void>;
}>;

const signedOutSchema = z.object({ signedOut: z.literal(true) });
const revokedSchema = z.object({ revoked: z.number().int().nonnegative() });
/** The API answers with the whole consent record; the UI only needs to know it landed. */
const consentSchema = z.object({ id: z.string() }).loose();

/**
 * All three, together. A family cannot consent to being heard but not transcribed — the
 * processors are one chain, and offering them separately would be offering a choice that does
 * not exist.
 */
const PROCESSOR_CATEGORIES = ['media', 'stt', 'tts'] as const;

/**
 * What our record will say the verification was: a parent signed in to their own account on
 * this device. Stronger adult verification is P2-03's, and is not claimed here.
 */
const VERIFICATION_REFERENCE = 'supabase-authenticated-parent';

export function createIdentityApi(client: ApiClient): IdentityApi {
  const asParent = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
  return {
    children: async (token) =>
      (await client.get('/api/v1/parent/children', childListResponseSchema, asParent(token)))
        .children,

    login: (token, input) =>
      client.post('/api/v1/auth/child/login', input, childSessionResponseSchema, asParent(token)),

    revokeAllSessions: async (token) =>
      (await client.post('/api/v1/parent/sessions/revoke', {}, revokedSchema, asParent(token)))
        .revoked,

    logout: async () => {
      await client.post('/api/v1/auth/child/logout', {}, signedOutSchema);
    },

    /**
     * `null` means the server said no. A network failure is *not* null: a child on a train
     * losing signal for ten seconds must not be signed out of their lesson, so anything that
     * is not a refusal is thrown and the caller leaves the session alone.
     */
    refresh: async () => {
      try {
        return await client.post('/api/v1/auth/child/refresh', {}, childSessionResponseSchema);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },

    addChild: (token, input) =>
      client.post('/api/v1/parent/children', input, childSummarySchema, asParent(token)),

    grantVoiceConsent: async (token, childId) => {
      await client.post(
        `/api/v1/parent/children/${childId}/consent/voice`,
        {
          processorCategories: PROCESSOR_CATEGORIES,
          verificationReference: VERIFICATION_REFERENCE,
        },
        consentSchema,
        asParent(token),
      );
    },

    updateChild: (token, childId, input) =>
      client.patch(
        `/api/v1/parent/children/${childId}`,
        input,
        childSummarySchema,
        asParent(token),
      ),
  };
}
