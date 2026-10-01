import { createApiClient } from '@/api';
import { createTelemetryApi } from '@/api/telemetry.api';
import { webConfig } from '@/app/config';
import { createIdentityApi, createParentSessionStore, createSupabaseApi } from '@/features/auth';
import { createTurnTimingReporter } from '@/lib/observability/timing';

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

const telemetryApi = createTelemetryApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

/**
 * The stopwatch behind the two §11 bars only a browser can see (X-04 part 2).
 *
 * One reporter for the app, not one per page, so the measurements of a session's opening —
 * the arrival, the audio unlocking, the first sound — share a queue and usually travel in one
 * request. Two reporters would be two queues and two requests for one child's first ten
 * seconds.
 *
 * `performance.now()` and not `Date.now()`: it is monotonic and immune to the clock being
 * corrected underneath a measurement, which is the whole reason the protocol carries durations
 * rather than timestamps.
 */
export const turnTimings = createTurnTimingReporter({
  now: () => performance.now(),
  send: (report) => telemetryApi.reportTurn(report).then(() => undefined),
});
