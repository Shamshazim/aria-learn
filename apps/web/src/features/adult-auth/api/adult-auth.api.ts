import { z } from 'zod';

import type { ApiClient } from '@/api/client';

/**
 * The four adult endpoints. The bearer token is a parameter here rather than a client-wide
 * header because sign-in is the request that first obtains it.
 */
export const adultRoleSchema = z.enum(['parent', 'teacher']);

export const adultAuthResponseSchema = z.object({
  adultId: z.string(),
  role: adultRoleSchema,
  parentId: z.string().nullable(),
  sessionId: z.string(),
});

export type AdultRole = z.infer<typeof adultRoleSchema>;
export type AdultAuthResponse = z.infer<typeof adultAuthResponseSchema>;

export type AdultAttestation = Readonly<{
  isAdult: boolean;
  role: AdultRole;
  displayName?: string;
}>;

export type AdultAuthApi = Readonly<{
  requestMagicLink(email: string, signal?: AbortSignal): Promise<null>;
  signIn(
    input: Readonly<{ accessToken: string; attestation: AdultAttestation }>,
    signal?: AbortSignal,
  ): Promise<AdultAuthResponse>;
  me(accessToken: string, signal?: AbortSignal): Promise<AdultAuthResponse>;
  signOut(accessToken: string): Promise<null>;
}>;

function bearer(accessToken: string, signal?: AbortSignal) {
  return {
    headers: { authorization: `Bearer ${accessToken}` },
    ...(signal === undefined ? {} : { signal }),
  };
}

export function createAdultAuthApi(client: ApiClient): AdultAuthApi {
  return {
    requestMagicLink: (email, signal) =>
      client.post(
        '/api/v1/auth/adult/magic-link',
        { email },
        z.null(),
        signal === undefined ? undefined : { signal },
      ),

    signIn: (input, signal) =>
      client.post(
        '/api/v1/auth/adult/session',
        { accessToken: input.accessToken, attestation: input.attestation },
        adultAuthResponseSchema,
        signal === undefined ? undefined : { signal },
      ),

    me: (accessToken, signal) =>
      client.get('/api/v1/auth/adult/me', adultAuthResponseSchema, bearer(accessToken, signal)),

    signOut: (accessToken) =>
      client.del('/api/v1/auth/adult/session', z.null(), bearer(accessToken)),
  };
}
