import { ADD_FACT_10_PARAMS } from '@/content/generation/arithmetic/params/add-fact-10';
import { ADD_REGROUP_2D_PARAMS } from '@/content/generation/arithmetic/params/add-regroup-2d';
import { FRAC_COMPARE_PARAMS } from '@/content/generation/arithmetic/params/frac-compare';
import { FRAC_EQUAL_PARAMS } from '@/content/generation/arithmetic/params/frac-equal';
import { NUM_CNT_20_PARAMS } from '@/content/generation/arithmetic/params/num-cnt-20';
import { NUM_CNT_SKIP5_PARAMS } from '@/content/generation/arithmetic/params/num-cnt-skip5';
import type { GeneratorParams } from '@/content/generation/arithmetic/types';
import type { ArithmeticSkillCode } from '@/quality/arithmetic';

/**
 * Every arithmetic skill's parameter space, keyed by its code (P2H-10).
 *
 * Exhaustive by type. Adding a skill to `ArithmeticSkillCode` without writing its parameters
 * fails the build here, which is the same bargain `SKILL_SOLVERS` already makes for the
 * checker: a skill Aria cannot generate for is a skill she should not claim to teach.
 */
export const SKILL_PARAMS: Readonly<Record<ArithmeticSkillCode, GeneratorParams>> = {
  'NUM.CNT.20': NUM_CNT_20_PARAMS,
  'NUM.CNT.SKIP5': NUM_CNT_SKIP5_PARAMS,
  'ADD.FACT.10': ADD_FACT_10_PARAMS,
  'ADD.REGROUP.2D': ADD_REGROUP_2D_PARAMS,
  'FRAC.EQUAL': FRAC_EQUAL_PARAMS,
  'FRAC.COMPARE': FRAC_COMPARE_PARAMS,
};

/** Written out rather than derived from the record, so no assertion is needed to name them. */
export const ARITHMETIC_SKILL_CODES: readonly ArithmeticSkillCode[] = [
  'NUM.CNT.20',
  'NUM.CNT.SKIP5',
  'ADD.FACT.10',
  'ADD.REGROUP.2D',
  'FRAC.EQUAL',
  'FRAC.COMPARE',
];
