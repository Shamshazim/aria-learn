import { ADD_SUB_SKILLS } from './add-sub.skills';
import { DECIMALS_PERCENT_SKILLS } from './decimals-percent.skills';
import { FRACTION_SKILLS } from './fractions.skills';
import { MUL_DIV_SKILLS } from './mul-div.skills';
import { NUM_SENSE_SKILLS } from './num-sense.skills';

/**
 * The authored arithmetic inventory, one file per strand (P3-07). Each strand ships as its
 * own change; `validate.ts` holds the assembled graph to its rules at startup.
 */
export const ARITHMETIC_SKILLS = [
  ...NUM_SENSE_SKILLS,
  ...ADD_SUB_SKILLS,
  ...MUL_DIV_SKILLS,
  ...FRACTION_SKILLS,
  ...DECIMALS_PERCENT_SKILLS,
];

/**
 * Where arithmetic starts. Listed, not inferred: a skill with no prerequisites that is not
 * here is an authoring mistake, and the validator says so.
 */
export const ARITHMETIC_ENTRY_SKILLS: readonly string[] = ['NUM.CNT.20'];
