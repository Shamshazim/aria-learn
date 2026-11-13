import { ADD_3D_PARAMS } from '@/content/generation/arithmetic/params/add-3d';
import { ADD_FACT_10_PARAMS } from '@/content/generation/arithmetic/params/add-fact-10';
import { ADD_FACT_20_PARAMS } from '@/content/generation/arithmetic/params/add-fact-20';
import { ADD_REGROUP_2D_PARAMS } from '@/content/generation/arithmetic/params/add-regroup-2d';
import { FRAC_COMPARE_PARAMS } from '@/content/generation/arithmetic/params/frac-compare';
import { FRAC_EQUAL_PARAMS } from '@/content/generation/arithmetic/params/frac-equal';
import { NUM_CMP_100_PARAMS } from '@/content/generation/arithmetic/params/num-cmp-100';
import { NUM_CNT_20_PARAMS } from '@/content/generation/arithmetic/params/num-cnt-20';
import { NUM_CNT_SKIP5_PARAMS } from '@/content/generation/arithmetic/params/num-cnt-skip5';
import { NUM_PV_HUNDREDS_PARAMS } from '@/content/generation/arithmetic/params/num-pv-hundreds';
import { NUM_PV_TENS_PARAMS } from '@/content/generation/arithmetic/params/num-pv-tens';
import { NUM_RND_10_PARAMS } from '@/content/generation/arithmetic/params/num-rnd-10';
import { SUB_FACT_10_PARAMS } from '@/content/generation/arithmetic/params/sub-fact-10';
import { SUB_REGROUP_2D_PARAMS } from '@/content/generation/arithmetic/params/sub-regroup-2d';
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
  'NUM.PV.TENS': NUM_PV_TENS_PARAMS,
  'NUM.PV.HUNDREDS': NUM_PV_HUNDREDS_PARAMS,
  'NUM.CMP.100': NUM_CMP_100_PARAMS,
  'NUM.RND.10': NUM_RND_10_PARAMS,
  'ADD.FACT.10': ADD_FACT_10_PARAMS,
  'ADD.FACT.20': ADD_FACT_20_PARAMS,
  'ADD.REGROUP.2D': ADD_REGROUP_2D_PARAMS,
  'ADD.3D': ADD_3D_PARAMS,
  'SUB.FACT.10': SUB_FACT_10_PARAMS,
  'SUB.REGROUP.2D': SUB_REGROUP_2D_PARAMS,
  'FRAC.EQUAL': FRAC_EQUAL_PARAMS,
  'FRAC.COMPARE': FRAC_COMPARE_PARAMS,
};

/** Written out rather than derived from the record, so no assertion is needed to name them. */
export const ARITHMETIC_SKILL_CODES: readonly ArithmeticSkillCode[] = [
  'NUM.CNT.20',
  'NUM.CNT.SKIP5',
  'NUM.PV.TENS',
  'NUM.PV.HUNDREDS',
  'NUM.CMP.100',
  'NUM.RND.10',
  'ADD.FACT.10',
  'ADD.FACT.20',
  'ADD.REGROUP.2D',
  'ADD.3D',
  'SUB.FACT.10',
  'SUB.REGROUP.2D',
  'FRAC.EQUAL',
  'FRAC.COMPARE',
];
