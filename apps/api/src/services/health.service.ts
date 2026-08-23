import type { Clock } from '@/lib/clock';
import type { HealthStatus } from '@/schemas/health.schema';

/**
 * Business logic for the health resource.
 *
 * Framework-free on purpose: no `req`, no `res`, no status codes. That is what lets its unit
 * test construct it with fakes and never import Express (CODE-STANDARDS §3.1), and it is the
 * shape every later service copies.
 */
export type HealthService = {
  getHealth(): HealthStatus;
};

export type HealthServiceDeps = {
  clock: Clock;
  startedAt: Date;
  version: string;
};

const MS_PER_SECOND = 1000;

/**
 * A factory with explicit dependencies, not a singleton: nothing here reads a module-level
 * pool, logger or clock, so two instances can exist in one test file without interfering.
 */
export function createHealthService({
  clock,
  startedAt,
  version,
}: HealthServiceDeps): HealthService {
  return {
    getHealth: () => {
      const elapsedMs = clock.now().getTime() - startedAt.getTime();

      return {
        status: 'ok',
        version,
        // A clock that has gone backwards must not produce a negative uptime.
        uptimeSeconds: Math.max(0, Math.floor(elapsedMs / MS_PER_SECOND)),
      };
    },
  };
}
