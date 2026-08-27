import { describe, expect, it } from 'vitest';

import { outputSafety } from '@/content/output-safety';
import type { ContentDraft } from '@/content/types';
import { createQualityGate } from '@/quality';
import {
  createPrewarmService,
  dryRunBank,
  prewarmTargets,
  PREWARM_TARGET,
  type ContentBank,
} from '@/services/content/prewarm.service';

/** An in-memory stand-in for `content_item`, keyed the way the real lookup is. */
function bank(): ContentBank & Readonly<{ rows: ContentDraft[] }> {
  const rows: ContentDraft[] = [];
  return {
    rows,
    listContentHashes: (target) =>
      Promise.resolve(
        rows
          .filter((row) => row.skillCode === target.skillCode && row.band === target.band)
          .flatMap((row) => {
            const body: unknown = row.body;
            const hash =
              typeof body === 'object' && body !== null && 'contentHash' in body
                ? body.contentHash
                : null;
            return typeof hash === 'string' ? [hash] : [];
          }),
      ),
    insert: (draft) => {
      rows.push(draft);
      return Promise.resolve();
    },
  };
}

function service(target: ContentBank) {
  return createPrewarmService({ bank: target, gate: createQualityGate(outputSafety) });
}

describe('pre-warming the content bank', () => {
  it('covers every arithmetic skill in every band a session can be in', () => {
    expect(prewarmTargets()).toHaveLength(18);
  });

  it('fills to the target and inserts nothing on a second run', async () => {
    const store = bank();

    const first = await service(store).run();
    const filled = store.rows.length;
    expect(filled).toBeGreaterThan(0);
    expect(first.every((outcome) => outcome.inserted > 0)).toBe(true);

    const second = await service(store).run();
    expect(store.rows).toHaveLength(filled);
    expect(second.every((outcome) => outcome.inserted === 0)).toBe(true);
  });

  it('tops up a partly filled bank rather than starting over', async () => {
    const store = bank();
    await service(store).run();
    const kept = store.rows.filter(
      (row) => row.skillCode !== 'ADD.FACT.10' || row.band !== 'middle',
    );
    const dropped = store.rows.length - kept.length;
    store.rows.length = 0;
    store.rows.push(...kept);

    const outcomes = await service(store).run();
    const topped = outcomes.find(
      (outcome) => outcome.skillCode === 'ADD.FACT.10' && outcome.band === 'middle',
    );
    expect(topped?.inserted).toBe(dropped);
  });

  it('reports a skill whose whole parameter space is smaller than the target', async () => {
    const outcomes = await service(dryRunBank()).run();
    const short = outcomes.filter((outcome) => outcome.exhausted);

    // Counting by five within fifty genuinely has fewer than forty questions in it. That is an
    // authoring fact to report, not a run to retry.
    expect(new Set(short.map((outcome) => outcome.skillCode))).toEqual(new Set(['NUM.CNT.SKIP5']));
    for (const outcome of outcomes.filter((entry) => !entry.exhausted)) {
      expect(outcome.inserted, `${outcome.skillCode}/${outcome.band}`).toBe(PREWARM_TARGET);
    }
  });

  it('stores nothing that fails the gate', async () => {
    const outcomes = await service(dryRunBank()).run();
    expect(outcomes.every((outcome) => outcome.rejected === 0)).toBe(true);
  });
});
