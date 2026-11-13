import { ADD_3D_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-3d.data';
import { ADD_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-fact-10.data';
import { ADD_FACT_20_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-fact-20.data';
import { ADD_REGROUP_2D_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-regroup-2d.data';
import { CMP_RETELL_MISCONCEPTIONS } from '@/curriculum/misconceptions/cmp-retell.data';
import { DIV_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/div-fact-10.data';
import { DIV_LONG_MISCONCEPTIONS } from '@/curriculum/misconceptions/div-long.data';
import { FL_WCPM_60_MISCONCEPTIONS } from '@/curriculum/misconceptions/fl-wcpm-60.data';
import { FRAC_COMPARE_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-compare.data';
import { FRAC_EQUAL_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-equal.data';
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
import { PH_CVC_MISCONCEPTIONS } from '@/curriculum/misconceptions/ph-cvc.data';
import { PH_SILENT_E_MISCONCEPTIONS } from '@/curriculum/misconceptions/ph-silent-e.data';
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
