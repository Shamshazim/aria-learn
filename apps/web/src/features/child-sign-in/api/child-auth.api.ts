import { z } from 'zod';

import type { PictureSecret } from '@aria/shared';

import type { ApiClient } from '@/api/client';

/**
 * The three child-side endpoints, and the only place the device secret and session token are
 * turned into headers.
 *
 * Responses are parsed, not asserted (§1) — the schemas below are the contract this app holds
 * the API to, and a server that changes shape fails here rather than three components later.
 */
export const childProfileSchema = z.object({
  studentId: z.string(),
  nickname: z.string(),
  avatarKey: z.string().nullable(),
});

const childProfilesSchema = z.array(childProfileSchema).readonly();

export const childSessionSchema = z.object({
  sessionId: z.string(),
  studentId: z.string(),
  token: z.string(),
  expiresAt: z.string(),
});

export type ChildProfile = z.infer<typeof childProfileSchema>;
export type ChildSession = z.infer<typeof childSessionSchema>;

export type ChildAuthApi = Readonly<{
  profiles(deviceSecret: string, signal?: AbortSignal): Promise<readonly ChildProfile[]>;
  open(
    input: Readonly<{ deviceSecret: string; studentId: string; pictureSecret: PictureSecret }>,
    signal?: AbortSignal,
  ): Promise<ChildSession>;
  end(sessionToken: string): Promise<null>;
}>;

const DEVICE_HEADER = 'x-aria-device';
const SESSION_HEADER = 'x-aria-child-session';

export function createChildAuthApi(client: ApiClient): ChildAuthApi {
  return {
    profiles: (deviceSecret, signal) =>
      client.get('/api/v1/child/profiles', childProfilesSchema, {
        headers: { [DEVICE_HEADER]: deviceSecret },
        ...(signal === undefined ? {} : { signal }),
      }),

    open: (input, signal) =>
      client.post(
        '/api/v1/child/session',
        { studentId: input.studentId, pictureSecret: [...input.pictureSecret] },
        childSessionSchema,
        {
          headers: { [DEVICE_HEADER]: input.deviceSecret },
          ...(signal === undefined ? {} : { signal }),
        },
      ),

    end: (sessionToken) =>
      client.del('/api/v1/child/session', z.null(), {
        headers: { [SESSION_HEADER]: sessionToken },
      }),
  };
}
