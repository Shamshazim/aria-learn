import type { Misconception } from '@aria/shared';

import { ADD_FACT_10_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-fact-10.data';
import { ADD_REGROUP_2D_MISCONCEPTIONS } from '@/curriculum/misconceptions/add-regroup-2d.data';
import { CMP_RETELL_MISCONCEPTIONS } from '@/curriculum/misconceptions/cmp-retell.data';
import { FL_WCPM_60_MISCONCEPTIONS } from '@/curriculum/misconceptions/fl-wcpm-60.data';
import { FRAC_COMPARE_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-compare.data';
import { FRAC_EQUAL_MISCONCEPTIONS } from '@/curriculum/misconceptions/frac-equal.data';
import { NUM_CNT_20_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-cnt-20.data';
import { NUM_CNT_SKIP5_MISCONCEPTIONS } from '@/curriculum/misconceptions/num-cnt-skip5.data';
import { PA_BLEND_MISCONCEPTIONS } from '@/curriculum/misconceptions/pa-blend.data';
import { PA_RHYME_MISCONCEPTIONS } from '@/curriculum/misconceptions/pa-rhyme.data';
import { PH_CVC_MISCONCEPTIONS } from '@/curriculum/misconceptions/ph-cvc.data';
import { PH_SILENT_E_MISCONCEPTIONS } from '@/curriculum/misconceptions/ph-silent-e.data';
import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';
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

/** The shared shape, without the matcher: what the `misconception` table stores. */
export function toMisconception(authored: AuthoredMisconception): Misconception {
  return {
    id: authored.id,
    skillCode: authored.skillCode,
    name: authored.name,
    signature: authored.signature,
    remediation: authored.remediation,
  };
}

export { matchesSignature, predictedAnswers } from '@/curriculum/misconceptions/signature';
export type {
  AuthoredMisconception,
  DerivedRule,
  MisconceptionInput,
  MisconceptionSignature,
} from '@/curriculum/misconceptions/signature.types';
