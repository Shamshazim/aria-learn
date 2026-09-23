import type { SpendReport } from '@/ai/cost';
import { sloCoverage, type SloCoverage } from '@/observability/slo/slos';

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
  /**
   * X-04: which of the §11 bars something is actually watching, and which are not.
   *
   * Here rather than only in a generated file because this is the route an operator reads
   * during an incident. "We promised seven numbers and two of them are measured" is a fact
   * worth having in front of somebody at that moment, and a gap that only exists in a source
   * constant is a gap nobody finds.
   */
  slos: SloCoverage;
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
        slos: sloCoverage(),
      };
    },
  };
}
