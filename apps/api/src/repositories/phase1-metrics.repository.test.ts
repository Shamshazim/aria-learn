import { describe, expect, it, vi } from 'vitest';

import type { Queryable } from '@/db/types';
import {
  createPhase1MetricsRepository,
  phase1MetricStatements,
} from '@/repositories/phase1-metrics.repository';

/**
 * X-04: the synthetic probe is "excluded from every report (P1-14, P7-04) by an `is_synthetic`
 * flag on `student`".
 *
 * Asserted per statement rather than against a result, because the mistake this guards is not
 * a wrong number — it is one query out of five that forgot the filter, which no fixture would
 * catch and which would look exactly like the four that did not forget. A report blended with
 * our own monitoring moves whenever the probe's schedule changes, which is the worst property
 * a measurement can have.
 */
describe('every statement the Phase 1 report runs', () => {
  const statements = phase1MetricStatements();

  it('is discovered, so an empty list would not pass by accident', () => {
    expect(statements.length).toBeGreaterThanOrEqual(5);
  });

  it.each(statements.map((sql, index) => [index, sql] as const))(
    'statement %i excludes a synthetic student',
    (_index, sql) => {
      expect(sql).toContain('NOT st.is_synthetic');
    },
  );

  it.each(statements.map((sql, index) => [index, sql] as const))(
    'statement %i reaches the flag through `student`, not a copy of it',
    (_index, sql) => {
      expect(sql).toContain('JOIN student st');
    },
  );

  it('takes no parameters, so no caller can widen what it reads', () => {
    for (const sql of statements) expect(sql).not.toContain('$1');
  });
});

describe('loading the report data', () => {
  it('runs every statement once and maps the rows it gets back', async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [], rowCount: 0 }));
    const db: Queryable = { query };

    const data = await createPhase1MetricsRepository(db).load();

    expect(query).toHaveBeenCalledTimes(phase1MetricStatements().length);
    expect(data).toEqual({
      events: [],
      endReasons: [],
      frustrationExitCount: 0,
      arrivalLatencies: [],
      factCount: 0,
      supportedFactCount: 0,
      correctionCount: 0,
      reflectedCorrectionCount: 0,
    });
  });
});
