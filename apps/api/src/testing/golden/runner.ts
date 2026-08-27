import { gradeGeneration } from '@/testing/golden/graders';
import { buildGoldenReport, type GoldenReport } from '@/testing/golden/report';
import type { CheckName, GoldenItem, GoldenSource, ItemResult } from '@/testing/golden/types';

/**
 * Runs every case against the source its origin names (P2H-10).
 *
 * One report covers both, because a child does not care which half produced their item: the
 * bar is the same, so the numbers belong in the same table.
 */
export async function runGoldenSet(input: {
  endpointName: string;
  promptVersion: string;
  items: readonly GoldenItem[];
  source: GoldenSource;
  generator: GoldenSource;
}): Promise<GoldenReport> {
  const results: ItemResult[] = [];
  for (const item of input.items) {
    results.push(await runItem(item, item.origin === 'generator' ? input.generator : input.source));
  }
  return buildGoldenReport({ ...input, results });
}

async function runItem(item: GoldenItem, source: GoldenSource): Promise<ItemResult> {
  try {
    return gradeGeneration(item, await source.generate(item));
  } catch {
    const failed = applicableChecks(item);
    const checks: Partial<Record<CheckName, boolean>> = {};
    for (const name of failed) checks[name] = false;
    return {
      itemId: item.id,
      latencyMs: 0,
      costUsd: 0,
      checks,
      failures: failed,
    };
  }
}

function applicableChecks(item: GoldenItem): readonly CheckName[] {
  const checks: CheckName[] = ['reading_level', 'markup', 'safety'];
  if (item.expectation.arithmeticProblem !== undefined) checks.push('arithmetic_correctness');
  if (item.expectation.expectedAnswer !== undefined) checks.push('factual_correctness');
  if (item.expectation.multipleChoice !== undefined) checks.push('correct_option_count');
  if (item.expectation.decodablePattern !== undefined) checks.push('decodable');
  return checks;
}
