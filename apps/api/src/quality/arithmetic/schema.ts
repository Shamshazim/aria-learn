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
    skillCode: z.enum(['ADD.FACT.10', 'ADD.FACT.20', 'ADD.REGROUP.2D', 'ADD.3D']),
    kind: z.literal('addition'),
    left: z.string(),
    right: z.string(),
  }),
  z.object({
    skillCode: z.enum(['SUB.FACT.10', 'SUB.REGROUP.2D']),
    kind: z.literal('subtraction'),
    left: z.string(),
    right: z.string(),
  }),
  z.object({
    skillCode: z.enum(['MUL.FACT.10', 'MUL.2D1D']),
    kind: z.literal('multiplication'),
    left: z.string(),
    right: z.string(),
  }),
  z.object({
    skillCode: z.enum(['DIV.FACT.10', 'DIV.LONG']),
    kind: z.literal('division'),
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
  z.object({
    skillCode: z.enum(['NUM.PV.TENS', 'NUM.PV.HUNDREDS']),
    kind: z.literal('place-value'),
    number: z.string(),
    place: z.enum(['ones', 'tens', 'hundreds', 'thousands']),
  }),
  z.object({
    skillCode: z.literal('NUM.CMP.100'),
    kind: z.literal('whole-comparison'),
    left: z.string(),
    right: z.string(),
  }),
  z.object({
    skillCode: z.literal('NUM.RND.10'),
    kind: z.literal('rounding'),
    number: z.string(),
    to: z.literal('10'),
  }),
]);
