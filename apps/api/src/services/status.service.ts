import type { SpendReport } from '@/ai/cost';

type EndpointHealthReader = Readonly<{
  get(
    endpointName: string,
  ): Readonly<{ reachable: boolean; lastProbeLatencyMs: number }> | undefined;
}>;

type BreakerStatus = Readonly<{
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
}>;

export type StatusResponse = Readonly<{
  endpoints: readonly Readonly<{
    name: string;
    configured: true;
    reachable: boolean | null;
    lastProbeLatencyMs: number | null;
    breakerState: BreakerStatus['state'];
    consecutiveFailures: number;
  }>[];
  spend: Readonly<{ totalTodayUsd: number; studentsAtCap: number }>;
}>;

export type StatusService = Readonly<{ getStatus(): Promise<StatusResponse> }>;

export function createStatusService(dependencies: {
  endpointNames: readonly string[];
  health: EndpointHealthReader;
  breakers: Readonly<{ get(endpointName: string): BreakerStatus }>;
  spend: Readonly<{ report(): Promise<SpendReport> }>;
}): StatusService {
  return {
    getStatus: async () => {
      const report = await dependencies.spend.report();
      return {
        endpoints: dependencies.endpointNames.map((name) => {
          const probe = dependencies.health.get(name);
          const breaker = dependencies.breakers.get(name);
          return {
            name,
            configured: true,
            reachable: probe?.reachable ?? null,
            lastProbeLatencyMs: probe?.lastProbeLatencyMs ?? null,
            breakerState: breaker.state,
            consecutiveFailures: breaker.consecutiveFailures,
          };
        }),
        spend: {
          totalTodayUsd: report.totalTodayUsd,
          studentsAtCap: report.studentsAtCap,
        },
      };
    },
  };
}
