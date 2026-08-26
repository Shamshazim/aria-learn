import { z } from 'zod';

const result = z
  .object({
    VITE_API_BASE_URL: z.string().optional(),
    VITE_REQUIRE_CHILD_SESSION: z.string().optional(),
  })
  .safeParse(import.meta.env);

const env = result.success ? result.data : {};

/**
 * `childSessionRequired` mirrors the API's demo fallback: the backend only accepts
 * `ARIA_DEMO_STUDENT_ID` outside production, and a dev build that had to open a real child
 * session before it could load a page would make that fallback unreachable. Any deployed
 * build requires the session; a dev build can opt back in with `VITE_REQUIRE_CHILD_SESSION`.
 */
export const webConfig: Readonly<{ apiBaseUrl: string; childSessionRequired: boolean }> = {
  apiBaseUrl: env.VITE_API_BASE_URL ?? '',
  childSessionRequired: import.meta.env.DEV ? env.VITE_REQUIRE_CHILD_SESSION === 'true' : true,
};
