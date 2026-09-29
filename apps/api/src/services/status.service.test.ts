import { expect, it } from 'vitest';

import { sloCoverage } from '@/observability/slo/slos';
import { createStatusService } from '@/services/status.service';

it('combines endpoint health, live breaker state and spend without sensitive configuration', async () => {
  const service = createStatusService({
    endpointNames: ['primary', 'fallback'],
    health: {
      get: (name) =>
        name === 'primary'
          ? { reachable: true, lastProbeLatencyMs: 8 }
          : { reachable: false, lastProbeLatencyMs: 20 },
    },
    breakers: {
      get: (name) => ({
        state: name === 'primary' ? 'closed' : 'open',
        consecutiveFailures: name === 'primary' ? 0 : 3,
      }),
    },
    spend: {
      report: () => Promise.resolve({ totalTodayUsd: 0.42, studentsAtCap: 2, students: [] }),
    },
  });

  const result = await service.getStatus();
  // X-04 added SLO coverage to the response. Checked apart from the deep-equal below so that
  // adding a bar to the registry does not fail an unrelated test; `slo/slos.test.ts` owns the
  // numbers themselves.
  const { slos, ...reported } = result;

  expect(slos).toEqual(sloCoverage());
  expect(reported).toEqual({
    endpoints: [
      {
        name: 'primary',
        configured: true,
        reachable: true,
        lastProbeLatencyMs: 8,
        breakerState: 'closed',
        consecutiveFailures: 0,
      },
      {
        name: 'fallback',
        configured: true,
        reachable: false,
        lastProbeLatencyMs: 20,
        breakerState: 'open',
        consecutiveFailures: 3,
      },
    ],
    spend: { totalTodayUsd: 0.42, studentsAtCap: 2 },
  });
  expect(JSON.stringify(result)).not.toMatch(/key|credential|base-url|prompt/i);
});
