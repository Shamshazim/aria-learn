import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

export type GoldenSubject = 'arithmetic' | 'reading' | 'writing';

/**
 * Where a golden case's item comes from (P2H-10).
 *
 * `model` cases grade a prompt: the item is written by an endpoint and the checks say whether
 * what came back was usable. `generator` cases grade code: the item is built deterministically
 * and the checks say whether the generator's own key survives an independent solve. Both
 * belong in one set because both are how a child gets an item.
 */
export type GoldenOrigin = 'model' | 'generator';

export type GoldenItem = Readonly<{
  id: string;
  subject: GoldenSubject;
  skillCode: string;
  band: Band;
  origin: GoldenOrigin;
  promptName?: 'practice-item' | undefined;
  input?: Readonly<{ skill: string; difficulty: 'easier' | 'same' | 'harder' }> | undefined;
  /** Which point of the generator's parameter space this case pins. */
  generatorIndex?: number | undefined;
  expectation: Readonly<{
    arithmeticProblem?: ArithmeticProblem | undefined;
    expectedAnswer?: string | undefined;
    decodablePattern?: 'cvc' | undefined;
    multipleChoice?: true | undefined;
  }>;
  humanReview: Readonly<{
    status: 'pending' | 'approved';
    notes: string;
    reviewer?: string | undefined;
    reviewedAt?: string | undefined;
  }>;
}>;

export type GoldenGeneration = Readonly<{
  prompt: string;
  answer: string;
  endpointName: string;
  model: string;
  latencyMs: number;
  costUsd: number;
  options?: readonly Readonly<{ id: string; text: string }>[] | undefined;
  answerKey?: string | undefined;
}>;

export type GoldenSource = Readonly<{
  generate(item: GoldenItem): Promise<GoldenGeneration>;
}>;

export type CheckName =
  | 'arithmetic_correctness'
  | 'factual_correctness'
  | 'correct_option_count'
  | 'reading_level'
  | 'markup'
  | 'decodable'
  | 'safety';

export type ItemResult = Readonly<{
  itemId: string;
  latencyMs: number;
  costUsd: number;
  checks: Readonly<Partial<Record<CheckName, boolean>>>;
  failures: readonly CheckName[];
}>;
