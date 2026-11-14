import { ADD_3D_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-3d.data';
import { ADD_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-fact-10.data';
import { ADD_FACT_20_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-fact-20.data';
import { ADD_REGROUP_2D_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-regroup-2d.data';
import { CMP_RETELL_MISCONCEPTIONS } from '@/curriculum/misconceptions/cmp-retell.data';
import { DATA_MEAN_MISCONCEPTIONS } from '@/curriculum/misconceptions/data-mean.data';
import { DEC_ADD_MISCONCEPTIONS } from '@/curriculum/misconceptions/dec-add.data';
import { DEC_CMP_MISCONCEPTIONS } from '@/curriculum/misconceptions/dec-cmp.data';
import { DEC_PV_MISCONCEPTIONS } from '@/curriculum/misconceptions/dec-pv.data';
import { DIV_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/div-fact-10.data';
import { DIV_LONG_MISCONCEPTIONS } from '@/curriculum/misconceptions/div-long.data';
import { EQN_ONE_MISCONCEPTIONS } from '@/curriculum/misconceptions/eqn-one.data';
import { EQN_TWO_MISCONCEPTIONS } from '@/curriculum/misconceptions/eqn-two.data';
import { EXP_EVAL_MISCONCEPTIONS } from '@/curriculum/misconceptions/exp-eval.data';
import { EXP_ORDER_MISCONCEPTIONS } from '@/curriculum/misconceptions/exp-order.data';
import { FL_WCPM_60_MISCONCEPTIONS } from '@/curriculum/misconceptions/fl-wcpm-60.data';
import { FRAC_ADD_LIKE_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-add-like.data';
import { FRAC_ADD_UNLIKE_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-add-unlike.data';
import { FRAC_COMPARE_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-compare.data';
import { FRAC_DIV_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-div.data';
import { FRAC_EQUAL_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-equal.data';
import { FRAC_EQUIV_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-equiv.data';
import { FRAC_MUL_WHOLE_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-mul-whole.data';
import { INT_ABS_MISCONCEPTIONS } from '@/curriculum/misconceptions/int-abs.data';
import { INT_ADD_MISCONCEPTIONS } from '@/curriculum/misconceptions/int-add.data';
import { INT_CMP_MISCONCEPTIONS } from '@/curriculum/misconceptions/int-cmp.data';
import { INT_MUL_MISCONCEPTIONS } from '@/curriculum/misconceptions/int-mul.data';
import { MEAS_AREA_MISCONCEPTIONS } from '@/curriculum/misconceptions/meas-area.data';
import { MEAS_CONV_MISCONCEPTIONS } from '@/curriculum/misconceptions/meas-conv.data';
import { MEAS_MONEY_MISCONCEPTIONS } from '@/curriculum/misconceptions/meas-money.data';
import { MEAS_TIME_MISCONCEPTIONS } from '@/curriculum/misconceptions/meas-time.data';
import { MUL_2D1D_MISCONCEPTIONS } from '@/curriculum/misconceptions/mul-2d1d.data';
import { MUL_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/mul-fact-10.data';
import { NUM_CMP_100_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-cmp-100.data';
import { NUM_CNT_20_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-cnt-20.data';
import { NUM_CNT_SKIP5_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-cnt-skip5.data';
import { NUM_PV_HUNDREDS_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-pv-hundreds.data';
import { NUM_PV_TENS_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-pv-tens.data';
import { NUM_RND_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-rnd-10.data';
import { PA_BLEND_MISCONCEPTIONS } from '@/curriculum/misconceptions/pa-blend.data';
import { PA_RHYME_MISCONCEPTIONS } from '@/curriculum/misconceptions/pa-rhyme.data';
import { PCT_OF_MISCONCEPTIONS } from '@/curriculum/misconceptions/pct-of.data';
import { PH_CVC_MISCONCEPTIONS } from '@/curriculum/misconceptions/ph-cvc.data';
import { PH_SILENT_E_MISCONCEPTIONS } from '@/curriculum/misconceptions/ph-silent-e.data';
import { RAT_EQUIV_MISCONCEPTIONS } from '@/curriculum/misconceptions/rat-equiv.data';
import { RAT_PROP_MISCONCEPTIONS } from '@/curriculum/misconceptions/rat-prop.data';
import { RAT_UNIT_MISCONCEPTIONS } from '@/curriculum/misconceptions/rat-unit.data';
import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';
import { SUB_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/sub-fact-10.data';
import { SUB_REGROUP_2D_MISCONCEPTIONS } from '@/curriculum/misconceptions/sub-regroup-2d.data';
import { WR_PARAGRAPH_MISCONCEPTIONS } from '@/curriculum/misconceptions/wr-paragraph.data';
import { WR_SENTENCE_MISCONCEPTIONS } from '@/curriculum/misconceptions/wr-sentence.data';
import { WR_SHORT_PIECE_MISCONCEPTIONS } from '@/curriculum/misconceptions/wr-short-piece.data';
import { WR_WORD_MISCONCEPTIONS } from '@/curriculum/misconceptions/wr-word.data';

/**
 * Every authored wrong idea, three or more per skill (P2H-10).
 *
 * One file per skill rather than one big table: a skill's misconceptions are written and
 * reviewed together, and a reviewer who owns fractions should never have to read past
 * handwriting to reach them.
 */
export const AUTHORED_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  ...NUM_CNT_20_MISCONCEPTIONS,
  ...NUM_CNT_SKIP5_MISCONCEPTIONS,
  ...NUM_PV_TENS_MISCONCEPTIONS,
  ...NUM_PV_HUNDREDS_MISCONCEPTIONS,
  ...NUM_CMP_100_MISCONCEPTIONS,
  ...NUM_RND_10_MISCONCEPTIONS,
  ...ADD_FACT_20_MISCONCEPTIONS,
  ...SUB_FACT_10_MISCONCEPTIONS,
  ...SUB_REGROUP_2D_MISCONCEPTIONS,
  ...ADD_3D_MISCONCEPTIONS,
  ...MUL_FACT_10_MISCONCEPTIONS,
  ...DIV_FACT_10_MISCONCEPTIONS,
  ...MUL_2D1D_MISCONCEPTIONS,
  ...DIV_LONG_MISCONCEPTIONS,
  ...FRAC_EQUIV_MISCONCEPTIONS,
  ...FRAC_ADD_LIKE_MISCONCEPTIONS,
  ...FRAC_ADD_UNLIKE_MISCONCEPTIONS,
  ...FRAC_MUL_WHOLE_MISCONCEPTIONS,
  ...DEC_PV_MISCONCEPTIONS,
  ...DEC_CMP_MISCONCEPTIONS,
  ...DEC_ADD_MISCONCEPTIONS,
  ...PCT_OF_MISCONCEPTIONS,
  ...INT_CMP_MISCONCEPTIONS,
  ...INT_ABS_MISCONCEPTIONS,
  ...INT_ADD_MISCONCEPTIONS,
  ...INT_MUL_MISCONCEPTIONS,
  ...RAT_EQUIV_MISCONCEPTIONS,
  ...RAT_UNIT_MISCONCEPTIONS,
  ...RAT_PROP_MISCONCEPTIONS,
  ...FRAC_DIV_MISCONCEPTIONS,
  ...EXP_ORDER_MISCONCEPTIONS,
  ...EXP_EVAL_MISCONCEPTIONS,
  ...EQN_ONE_MISCONCEPTIONS,
  ...EQN_TWO_MISCONCEPTIONS,
  ...MEAS_TIME_MISCONCEPTIONS,
  ...MEAS_MONEY_MISCONCEPTIONS,
  ...MEAS_AREA_MISCONCEPTIONS,
  ...MEAS_CONV_MISCONCEPTIONS,
  ...DATA_MEAN_MISCONCEPTIONS,
  ...ADD_FACT_10_MISCONCEPTIONS,
  ...ADD_REGROUP_2D_MISCONCEPTIONS,
  ...FRAC_EQUAL_MISCONCEPTIONS,
  ...FRAC_COMPARE_MISCONCEPTIONS,
  ...PA_RHYME_MISCONCEPTIONS,
  ...PA_BLEND_MISCONCEPTIONS,
  ...PH_CVC_MISCONCEPTIONS,
  ...PH_SILENT_E_MISCONCEPTIONS,
  ...FL_WCPM_60_MISCONCEPTIONS,
  ...CMP_RETELL_MISCONCEPTIONS,
  ...WR_WORD_MISCONCEPTIONS,
  ...WR_SENTENCE_MISCONCEPTIONS,
  ...WR_PARAGRAPH_MISCONCEPTIONS,
  ...WR_SHORT_PIECE_MISCONCEPTIONS,
];
