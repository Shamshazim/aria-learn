import { z } from 'zod';

import type { ArithmeticProblem } from '@/quality/arithmetic/types';

export const arithmeticProblemSchema: z.ZodType<ArithmeticProblem> = z.discriminatedUnion('kind', [
  z.object({
    skillCode: z.enum(['NUM.CNT.20', 'NUM.CNT.SKIP5']),
    kind: z.literal('sequence'),
    values: z.array(z.string()).min(1),
    step: z.string(),
  }),
  z.object({
    skillCode: z.enum(['ADD.FACT.10', 'ADD.REGROUP.2D']),
    kind: z.literal('addition'),
    left: z.string(),
    right: z.string(),
  }),
  z.object({
    skillCode: z.literal('FRAC.EQUAL'),
    kind: z.literal('fraction-equality'),
    left: z.string(),
    right: z.string(),
  }),
  z.object({
    skillCode: z.literal('FRAC.COMPARE'),
    kind: z.literal('fraction-comparison'),
    left: z.string(),
    right: z.string(),
  }),
]);
