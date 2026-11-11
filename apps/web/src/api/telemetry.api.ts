import { turnTimingResponseSchema, type TurnTimingResponse } from '@aria/shared';

import type { ApiClient } from '@/api/client';
import type { TimingReport } from '@/lib/observability/timing';

/**
 * `POST /api/v1/telemetry/turn` (X-04 part 2).
 *
 * It lives in `api/` rather than in a feature, because both features that measure — the class
 * picker and the session — report through one endpoint, and `api/` is the only place a request
 * is made (CODE-STANDARDS §3.2).
 *
 * The timeout is short. A report is worth a second or two of a child's network and no more:
 * the measurement has already happened, and a request still open thirty seconds later is
 * holding a connection for a number nobody is waiting on.
 */
const TELEMETRY_TIMEOUT_MS = 3_000;

export type TelemetryApi = Readonly<{
  reportTurn(report: TimingReport): Promise<TurnTimingResponse>;
}>;

export function createTelemetryApi(client: ApiClient): TelemetryApi {
  return {
    reportTurn: (report) =>
      client.post('/api/v1/telemetry/turn', report, turnTimingResponseSchema, {
        timeoutMs: TELEMETRY_TIMEOUT_MS,
      }),
  };
}
