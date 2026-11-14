import { ADD_3D_PARAMS } from '@/content/generation/arithmetic/params/add-3d';
import { ADD_FACT_10_PARAMS } from '@/content/generation/arithmetic/params/add-fact-10';
import { ADD_FACT_20_PARAMS } from '@/content/generation/arithmetic/params/add-fact-20';
import { ADD_REGROUP_2D_PARAMS } from '@/content/generation/arithmetic/params/add-regroup-2d';
import { DATA_MEAN_PARAMS } from '@/content/generation/arithmetic/params/data-mean';
import { DEC_ADD_PARAMS } from '@/content/generation/arithmetic/params/dec-add';
import { DEC_CMP_PARAMS } from '@/content/generation/arithmetic/params/dec-cmp';
import { DEC_PV_PARAMS } from '@/content/generation/arithmetic/params/dec-pv';
import { DIV_FACT_10_PARAMS } from '@/content/generation/arithmetic/params/div-fact-10';
import { DIV_LONG_PARAMS } from '@/content/generation/arithmetic/params/div-long';
import { EQN_ONE_PARAMS } from '@/content/generation/arithmetic/params/eqn-one';
import { EQN_TWO_PARAMS } from '@/content/generation/arithmetic/params/eqn-two';
import { EXP_EVAL_PARAMS } from '@/content/generation/arithmetic/params/exp-eval';
import { EXP_ORDER_PARAMS } from '@/content/generation/arithmetic/params/exp-order';
import { FRAC_ADD_LIKE_PARAMS } from '@/content/generation/arithmetic/params/frac-add-like';
import { FRAC_ADD_UNLIKE_PARAMS } from '@/content/generation/arithmetic/params/frac-add-unlike';
import { FRAC_COMPARE_PARAMS } from '@/content/generation/arithmetic/params/frac-compare';
import { FRAC_DIV_PARAMS } from '@/content/generation/arithmetic/params/frac-div';
import { FRAC_EQUAL_PARAMS } from '@/content/generation/arithmetic/params/frac-equal';
import { FRAC_EQUIV_PARAMS } from '@/content/generation/arithmetic/params/frac-equiv';
import { FRAC_MUL_WHOLE_PARAMS } from '@/content/generation/arithmetic/params/frac-mul-whole';
import { INT_ABS_PARAMS } from '@/content/generation/arithmetic/params/int-abs';
import { INT_ADD_PARAMS } from '@/content/generation/arithmetic/params/int-add';
import { INT_CMP_PARAMS } from '@/content/generation/arithmetic/params/int-cmp';
import { INT_MUL_PARAMS } from '@/content/generation/arithmetic/params/int-mul';
import { MEAS_AREA_PARAMS } from '@/content/generation/arithmetic/params/meas-area';
import { MEAS_CONV_PARAMS } from '@/content/generation/arithmetic/params/meas-conv';
import { MEAS_MONEY_PARAMS } from '@/content/generation/arithmetic/params/meas-money';
import { MEAS_TIME_PARAMS } from '@/content/generation/arithmetic/params/meas-time';
import { MUL_2D1D_PARAMS } from '@/content/generation/arithmetic/params/mul-2d1d';
import { MUL_FACT_10_PARAMS } from '@/content/generation/arithmetic/params/mul-fact-10';
import { NUM_CMP_100_PARAMS } from '@/content/generation/arithmetic/params/num-cmp-100';
import { NUM_CNT_20_PARAMS } from '@/content/generation/arithmetic/params/num-cnt-20';
import { NUM_CNT_SKIP5_PARAMS } from '@/content/generation/arithmetic/params/num-cnt-skip5';
import { NUM_PV_HUNDREDS_PARAMS } from '@/content/generation/arithmetic/params/num-pv-hundreds';
import { NUM_PV_TENS_PARAMS } from '@/content/generation/arithmetic/params/num-pv-tens';
import { NUM_RND_10_PARAMS } from '@/content/generation/arithmetic/params/num-rnd-10';
import { PCT_OF_PARAMS } from '@/content/generation/arithmetic/params/pct-of';
import { RAT_EQUIV_PARAMS } from '@/content/generation/arithmetic/params/rat-equiv';
import { RAT_PROP_PARAMS } from '@/content/generation/arithmetic/params/rat-prop';
import { RAT_UNIT_PARAMS } from '@/content/generation/arithmetic/params/rat-unit';
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
  'MUL.FACT.10': MUL_FACT_10_PARAMS,
  'MUL.2D1D': MUL_2D1D_PARAMS,
  'DIV.FACT.10': DIV_FACT_10_PARAMS,
  'DIV.LONG': DIV_LONG_PARAMS,
  'FRAC.EQUAL': FRAC_EQUAL_PARAMS,
  'FRAC.COMPARE': FRAC_COMPARE_PARAMS,
  'FRAC.EQUIV': FRAC_EQUIV_PARAMS,
  'FRAC.ADD.LIKE': FRAC_ADD_LIKE_PARAMS,
  'FRAC.ADD.UNLIKE': FRAC_ADD_UNLIKE_PARAMS,
  'FRAC.MUL.WHOLE': FRAC_MUL_WHOLE_PARAMS,
  'DEC.PV': DEC_PV_PARAMS,
  'DEC.CMP': DEC_CMP_PARAMS,
  'DEC.ADD': DEC_ADD_PARAMS,
  'PCT.OF': PCT_OF_PARAMS,
  'INT.CMP': INT_CMP_PARAMS,
  'INT.ABS': INT_ABS_PARAMS,
  'INT.ADD': INT_ADD_PARAMS,
  'INT.MUL': INT_MUL_PARAMS,
  'RAT.EQUIV': RAT_EQUIV_PARAMS,
  'RAT.UNIT': RAT_UNIT_PARAMS,
  'RAT.PROP': RAT_PROP_PARAMS,
  'FRAC.DIV': FRAC_DIV_PARAMS,
  'EXP.ORDER': EXP_ORDER_PARAMS,
  'EXP.EVAL': EXP_EVAL_PARAMS,
  'EQN.ONE': EQN_ONE_PARAMS,
  'EQN.TWO': EQN_TWO_PARAMS,
  'MEAS.TIME': MEAS_TIME_PARAMS,
  'MEAS.MONEY': MEAS_MONEY_PARAMS,
  'MEAS.AREA': MEAS_AREA_PARAMS,
  'MEAS.CONV': MEAS_CONV_PARAMS,
  'DATA.MEAN': DATA_MEAN_PARAMS,
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
  'MUL.FACT.10',
  'MUL.2D1D',
  'DIV.FACT.10',
  'DIV.LONG',
  'FRAC.EQUAL',
  'FRAC.COMPARE',
  'FRAC.EQUIV',
  'FRAC.ADD.LIKE',
  'FRAC.ADD.UNLIKE',
  'FRAC.MUL.WHOLE',
  'DEC.PV',
  'DEC.CMP',
  'DEC.ADD',
  'PCT.OF',
  'INT.CMP',
  'INT.ABS',
  'INT.ADD',
  'INT.MUL',
  'RAT.EQUIV',
  'RAT.UNIT',
  'RAT.PROP',
  'FRAC.DIV',
  'EXP.ORDER',
  'EXP.EVAL',
  'EQN.ONE',
  'EQN.TWO',
  'MEAS.TIME',
  'MEAS.MONEY',
  'MEAS.AREA',
  'MEAS.CONV',
  'DATA.MEAN',
];
