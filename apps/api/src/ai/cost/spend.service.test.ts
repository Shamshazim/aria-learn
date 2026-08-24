import { describe, expect, it, vi } from 'vitest';

import { createSpendService, SpendCapExceededError } from '@/ai/cost/spend.service';
import { fixedClock } from '@/lib/clock';
import type { AiGenerationLogRepository } from '@/repositories/ai-generation-log.repository';

function repository(daySpend: number): AiGenerationLogRepository {
  return {
    insert: vi.fn(() => Promise.resolve()),
    daySpend: vi.fn(() => Promise.resolve(daySpend)),
    report: vi.fn(() =>
      Promise.resolve({ totalTodayUsd: daySpend, studentsAtCap: 0, students: [] }),
    ),
  };
}

describe('student spend cap', () => {
  it('allows generation below the configured daily cap', async () => {
    const service = createSpendService({
      repository: repository(0.49),
      clock: fixedClock(new Date('2026-08-24T10:00:00Z')),
      capUsd: 0.5,
      alert: vi.fn(),
    });

    await expect(service.assertWithinCap('student-1')).resolves.toBeUndefined();
  });

  it('trips at the cap, alerts operators, and signals cache-only mode', async () => {
    const alert = vi.fn();
    const service = createSpendService({
      repository: repository(0.5),
      clock: fixedClock(new Date('2026-08-24T10:00:00Z')),
      capUsd: 0.5,
      alert,
    });

    await expect(service.assertWithinCap('student-1')).rejects.toBeInstanceOf(
      SpendCapExceededError,
    );
    expect(alert).toHaveBeenCalledWith({
      kind: 'student_daily_cap',
      studentId: 'student-1',
      spendUsd: 0.5,
      capUsd: 0.5,
    });
  });

  it('records a cache hit with zero cost and no model tokens', async () => {
    const repo = repository(0);
    const service = createSpendService({
      repository: repo,
      clock: fixedClock(new Date('2026-08-24T10:00:00Z')),
      capUsd: 1,
      alert: vi.fn(),
    });

    await service.recordCachedHit({ studentId: 'student-1', tier: 'FAST' });

    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ cached: true, costUsd: 0, tokensIn: 0, tokensOut: 0 }),
    );
  });
});
