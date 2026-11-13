import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Different-size pieces cannot be counted together until they are made the same size. */
export const FRAC_ADD_UNLIKE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-add-unlike-combined-denominators',
    skillCode: 'FRAC.ADD.UNLIKE',
    name: 'Adds the tops and adds the bottoms',
    signature: 'Adds numerators together and denominators together',
    remediation: 'A half and a third make more than a half. Two fifths is less. Check the size.',
    approach: 'visual-model',
    model: 'a half bar and a third bar laid end to end against a whole',
    detects: { kind: 'derived', rule: 'combined-denominators' },
  },
  {
    id: 'misconception-frac-add-unlike-kept-one-denominator',
    skillCode: 'FRAC.ADD.UNLIKE',
    name: 'Keeps one of the bottoms',
    signature: 'Adds the numerators and keeps the larger denominator without renaming',
    remediation: 'Halves and thirds are different sizes. Cut both into sixths first.',
    approach: 'visual-model',
    model: 'a half and a third each re-cut into sixths',
    detects: { kind: 'derived', rule: 'kept-one-denominator' },
  },
  {
    id: 'misconception-frac-add-unlike-renamed-bottoms-only',
    skillCode: 'FRAC.ADD.UNLIKE',
    name: 'Renames the bottom but not the top',
    signature: 'Finds the common denominator but keeps the old numerators',
    remediation: 'One half is three sixths, not one sixth. Change the top when the bottom changes.',
    approach: 'worked-example',
    model: 'one half re-cut into sixths, with three of them shaded',
    detects: { kind: 'derived', rule: 'renamed-denominators-only' },
  },
];
