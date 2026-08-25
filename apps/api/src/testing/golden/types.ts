import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

export type GoldenSubject = 'arithmetic' | 'reading' | 'writing';

export type GoldenItem = Readonly<{
  id: string;
  subject: GoldenSubject;
  skillCode: string;
  band: Band;
  promptName: 'practice-item';
  input: Readonly<{ skill: string; difficulty: 'easier' | 'same' | 'harder' }>;
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
