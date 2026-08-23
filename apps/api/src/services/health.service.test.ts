import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { createHealthService } from '@/services/health.service';

/**
 * A service test constructs the service with fakes and never imports Express. If this file
 * ever needs a request, a response or a status code, the logic has leaked upward into the
 * controller layer (CODE-STANDARDS §3.1).
 */
const startedAt = new Date('2026-08-22T10:00:00Z');

describe('createHealthService', () => {
  it('reports ok with the version it was given', () => {
    const service = createHealthService({
      clock: fixedClock(startedAt),
      startedAt,
      version: '1.2.3',
    });

    expect(service.getHealth()).toEqual({ status: 'ok', version: '1.2.3', uptimeSeconds: 0 });
  });

  it('derives uptime from the injected clock, not from wall time', () => {
    const service = createHealthService({
      clock: fixedClock(new Date('2026-08-22T10:01:30Z')),
      startedAt,
      version: '1.0.0',
    });

    expect(service.getHealth().uptimeSeconds).toBe(90);
  });

  it('floors a partial second rather than reporting a fraction', () => {
    const service = createHealthService({
      clock: fixedClock(new Date('2026-08-22T10:00:01.900Z')),
      startedAt,
      version: '1.0.0',
    });

    expect(service.getHealth().uptimeSeconds).toBe(1);
  });

  it('never reports negative uptime when the clock has gone backwards', () => {
    const service = createHealthService({
      clock: fixedClock(new Date('2026-08-22T09:59:00Z')),
      startedAt,
      version: '1.0.0',
    });

    expect(service.getHealth().uptimeSeconds).toBe(0);
  });

  it('builds independent instances, so nothing is shared through a module singleton', () => {
    const deps = { clock: fixedClock(startedAt), startedAt };
    const one = createHealthService({ ...deps, version: 'a' });
    const two = createHealthService({ ...deps, version: 'b' });

    expect(one.getHealth().version).toBe('a');
    expect(two.getHealth().version).toBe('b');
  });
});
