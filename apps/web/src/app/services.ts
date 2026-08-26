import { createApiClient } from '@/api';
import { webConfig } from '@/app/config';
import { createIdentityApi, createParentSessionStore, createSupabaseApi } from '@/features/auth';

/**
 * The long-lived objects the app is composed from (P2H-12).
 *
 * Built once, at module scope, and in one place. A second `createIdentityApi` somewhere else
 * would be a second api client and a second source of truth for the base url; worse, a new
 * object identity on every render restarts the effects that depend on it — including the one
 * that asks whether a child is signed in on this device.
 *
 * `app/` is where composition lives (CODE-STANDARDS §3.2). A page imports from here; it does
 * not build its own.
 */
export const identityApi = createIdentityApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

export const supabaseApi =
  webConfig.supabase === undefined ? undefined : createSupabaseApi(webConfig.supabase);

export const parentSessionStore = createParentSessionStore(window.localStorage);
