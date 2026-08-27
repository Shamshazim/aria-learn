import { BANDS, type Band } from '@aria/shared';

import {
  generateItem,
  parameterSpaceSize,
  ARITHMETIC_SKILL_CODES,
} from '@/content/generation/arithmetic';
import { toGeneratedContent } from '@/content/generation/arithmetic-draft';
import type { ContentDraft } from '@/content/types';
import type { GatePass, QualityGate } from '@/quality';
import type { ArithmeticSkillCode } from '@/quality/arithmetic';

/** The bank depth a skill and band should reach before a child ever asks for one. */
export const PREWARM_TARGET = 40;

export type PrewarmTarget = Readonly<{ skillCode: ArithmeticSkillCode; band: Band }>;

export type PrewarmOutcome = PrewarmTarget &
  Readonly<{
    existing: number;
    inserted: number;
    /** True when the skill's whole parameter space is smaller than the target. */
    exhausted: boolean;
    rejected: number;
  }>;

/**
 * Where pre-warmed items are read from and written to.
 *
 * A port rather than the repository itself, so a dry run can answer "nothing stored yet" from
 * memory and never open a connection: a reviewer checking what a run would insert should not
 * need a database to see it.
 */
export type ContentBank = Readonly<{
  /** The `contentHash` of every shareable item already stored for this skill and band. */
  listContentHashes(target: PrewarmTarget): Promise<readonly string[]>;
  /**
   * The `GatePass` is a brand the quality gate alone can mint, so a draft cannot reach the
   * bank without having been gated. The store does not persist it — the row's existence is
   * what the pass bought.
   */
  insert(draft: ContentDraft, pass: GatePass): Promise<void>;
}>;

export type PrewarmService = Readonly<{
  run(): Promise<readonly PrewarmOutcome[]>;
}>;

/** Every arithmetic skill in every band a session can be in. */
export function prewarmTargets(): readonly PrewarmTarget[] {
  return ARITHMETIC_SKILL_CODES.flatMap((skillCode) =>
    BANDS.map((band): PrewarmTarget => ({ skillCode, band })),
  );
}

/**
 * Fills the bank to `PREWARM_TARGET` items per skill per band, idempotently (P2H-10).
 *
 * Idempotent without a schema change: the generator enumerates the same space in the same
 * order every time, so a second run recognises what the first one wrote by its prompt and
 * tops up the difference. Running it twice inserts nothing the second time.
 */
export function createPrewarmService(
  dependencies: Readonly<{ bank: ContentBank; gate: QualityGate }>,
): PrewarmService {
  return {
    run: async () => {
      const outcomes: PrewarmOutcome[] = [];
      for (const target of prewarmTargets()) outcomes.push(await fill(dependencies, target));
      return outcomes;
    },
  };
}

async function fill(
  dependencies: Readonly<{ bank: ContentBank; gate: QualityGate }>,
  target: PrewarmTarget,
): Promise<PrewarmOutcome> {
  const stored = new Set(await dependencies.bank.listContentHashes(target));
  const existing = stored.size;
  const size = parameterSpaceSize(target.skillCode);
  let rejected = 0;
  for (let index = 0; index < size && stored.size < PREWARM_TARGET; index += 1) {
    const item = generateItem({ ...target, index });
    if (item === null || stored.has(item.contentHash)) continue;
    const content = toGeneratedContent(item, 'question');
    const verdict = dependencies.gate(content.gateInput);
    if (verdict.verdict === 'fail') {
      rejected += 1;
      continue;
    }
    await dependencies.bank.insert(content.draft, verdict.pass);
    stored.add(item.contentHash);
  }
  return {
    ...target,
    existing,
    inserted: stored.size - existing,
    rejected,
    exhausted: stored.size < PREWARM_TARGET,
  };
}

/**
 * The bank a `--dry-run` counts against: nothing stored, nothing written.
 *
 * It is a production mode rather than a test double. A reviewer needs to see what a real run
 * would insert without a database in front of them, and reading empty is what makes the
 * printed plan the whole plan.
 */
export function dryRunBank(): ContentBank {
  return {
    listContentHashes: () => Promise.resolve([]),
    insert: () => Promise.resolve(),
  };
}
