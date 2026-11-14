import { item } from '@/content/fallback/fallback-arithmetic.data';
import type { FallbackDefinition } from '@/content/fallback/fallback.data';

/**
 * Reviewed last-resort items for the P3-07 strands past whole numbers — fractions, decimals and
 * percent, integers — one per skill, built and gate-checked exactly like the whole-number ones.
 * A separate file so neither stays near the 300-line limit as strands are added.
 */
export const ARITHMETIC_BEYOND_FALLBACKS: readonly FallbackDefinition[] = [
  // P3-07, strand 4: fractions.
  item({
    skillCode: 'FRAC.EQUIV',
    band: 'middle',
    prompt: '2/3 = ?/12. What is the missing number?',
    choices: ['11', '8', '4'],
    answer: '8',
    problem: { skillCode: 'FRAC.EQUIV', kind: 'fraction-missing', left: '2/3', denominator: '12' },
  }),
  item({
    skillCode: 'FRAC.ADD.LIKE',
    band: 'middle',
    prompt: 'What is 3/8 add 2/8?',
    choices: ['5/16', '5/8', '1/8'],
    answer: '5/8',
    problem: {
      skillCode: 'FRAC.ADD.LIKE',
      kind: 'fraction-operation',
      operation: 'add',
      left: '3/8',
      right: '2/8',
    },
  }),
  item({
    skillCode: 'FRAC.ADD.UNLIKE',
    band: 'middle',
    prompt: 'What is 1/2 add 1/3?',
    choices: ['2/5', '5/6', '2/3'],
    answer: '5/6',
    problem: {
      skillCode: 'FRAC.ADD.UNLIKE',
      kind: 'fraction-operation',
      operation: 'add',
      left: '1/2',
      right: '1/3',
    },
  }),
  item({
    skillCode: 'FRAC.MUL.WHOLE',
    band: 'middle',
    prompt: 'What is 3 times 2/5?',
    choices: ['6/15', '3 2/5', '1 1/5'],
    answer: '1 1/5',
    problem: {
      skillCode: 'FRAC.MUL.WHOLE',
      kind: 'fraction-operation',
      operation: 'multiply',
      left: '3',
      right: '2/5',
    },
  }),
  // P3-07, strand 5: decimals and percent.
  item({
    skillCode: 'DEC.PV',
    band: 'middle',
    prompt: 'In 3.47, which digit is in the tenths place?',
    choices: ['7', '4', '3'],
    answer: '4',
    problem: { skillCode: 'DEC.PV', kind: 'decimal-place', number: '3.47', place: 'tenths' },
  }),
  item({
    skillCode: 'DEC.CMP',
    band: 'middle',
    prompt: 'Is 0.3 more than, less than, or the same as 0.25?',
    choices: ['>', '<', '='],
    answer: '>',
    problem: { skillCode: 'DEC.CMP', kind: 'decimal-comparison', left: '0.3', right: '0.25' },
  }),
  item({
    skillCode: 'DEC.ADD',
    band: 'middle',
    prompt: 'What is 3.4 add 1.25?',
    choices: ['1.59', '4.65', '4.29'],
    answer: '4.65',
    problem: {
      skillCode: 'DEC.ADD',
      kind: 'decimal-operation',
      operation: 'add',
      left: '3.4',
      right: '1.25',
    },
  }),
  item({
    skillCode: 'PCT.OF',
    band: 'senior',
    prompt: 'What is 25% of 80?',
    choices: ['20', '55', '2000'],
    answer: '20',
    problem: { skillCode: 'PCT.OF', kind: 'percent-of', percent: '25', whole: '80' },
  }),
  // P3-07, strand 6: integers.
  item({
    skillCode: 'INT.CMP',
    band: 'senior',
    prompt: 'Compare -7 and -3. Use <, > or =.',
    choices: ['>', '<', '='],
    answer: '<',
    problem: { skillCode: 'INT.CMP', kind: 'integer-comparison', left: '-7', right: '-3' },
  }),
  item({
    skillCode: 'INT.ABS',
    band: 'senior',
    prompt: 'What is the absolute value of -7?',
    choices: ['-7', '7', '8'],
    answer: '7',
    problem: { skillCode: 'INT.ABS', kind: 'absolute-value', number: '-7' },
  }),
  item({
    skillCode: 'INT.ADD',
    band: 'senior',
    prompt: 'What is -5 add 3?',
    choices: ['2', '-8', '-2'],
    answer: '-2',
    problem: {
      skillCode: 'INT.ADD',
      kind: 'integer-operation',
      operation: 'add',
      left: '-5',
      right: '3',
    },
  }),
  item({
    skillCode: 'INT.MUL',
    band: 'senior',
    prompt: 'What is -6 times -4?',
    choices: ['-24', '24', '-10'],
    answer: '24',
    problem: {
      skillCode: 'INT.MUL',
      kind: 'integer-operation',
      operation: 'multiply',
      left: '-6',
      right: '-4',
    },
  }),
  // P3-07, strand 7: ratio and proportion, and dividing fractions.
  item({
    skillCode: 'RAT.EQUIV',
    band: 'senior',
    prompt: '2 : 3 = 8 : ?',
    choices: ['9', '12', '4'],
    answer: '12',
    problem: {
      skillCode: 'RAT.EQUIV',
      kind: 'ratio-missing',
      first: '2',
      second: '3',
      scaledFirst: '8',
    },
  }),
  item({
    skillCode: 'RAT.UNIT',
    band: 'senior',
    prompt: '48 km in 4 hours. How many km in 1 hour?',
    choices: ['12', '44', '192'],
    answer: '12',
    problem: {
      skillCode: 'RAT.UNIT',
      kind: 'unit-rate',
      amount: '48',
      per: '4',
      amountUnit: 'km',
      perUnit: 'hour',
    },
  }),
  item({
    skillCode: 'RAT.PROP',
    band: 'senior',
    prompt: '3 pens cost $12. How much do 5 pens cost?',
    choices: ['14', '20', '60'],
    answer: '20',
    problem: {
      skillCode: 'RAT.PROP',
      kind: 'proportion',
      count: '3',
      total: '12',
      asked: '5',
      thing: 'pens',
    },
  }),
  item({
    skillCode: 'FRAC.DIV',
    band: 'senior',
    prompt: '3/4 ÷ 1/8 = ?',
    choices: ['3/32', '6', '1/6'],
    answer: '6',
    problem: {
      skillCode: 'FRAC.DIV',
      kind: 'fraction-operation',
      operation: 'divide',
      left: '3/4',
      right: '1/8',
    },
  }),
];
