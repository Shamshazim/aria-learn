import type { Skill } from '@aria/shared';

/**
 * Fractions (P3-07). Standards: 2.G.A.3 / 3.NF.A.1 (equal parts of a whole), 3.NF.A.3.d
 * (comparing fractions with the same denominator), 4.NF.A.1 (equivalent fractions), 4.NF.B.3.a
 * (adding and taking away with like denominators), 4.NF.B.4.b (a whole number times a
 * fraction) and 5.NF.A.1 (adding and taking away with unlike denominators). Equal parts are
 * counted, so the strand starts from counting; equivalence and multiplication stand on the
 * times tables.
 *
 * Unlike denominators is the strand's one `procedure`: find a common denominator, rename,
 * then add. The rest are ideas about the size of a piece, taught with bars, not drilled.
 */
export const FRACTION_SKILLS = [
  {
    id: 'skill-frac-equal',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.EQUAL',
    name: 'Recognise a fraction as equal pieces of a whole',
    band: 'early',
    prerequisites: ['NUM.CNT.20'],
    lessonRef: 'lesson-frac-equal',
    visualKinds: ['fraction-bar', 'array'],
    mode: 'number_sense',
  },
  {
    id: 'skill-frac-compare',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.COMPARE',
    name: 'Compare fractions with the same denominator',
    band: 'middle',
    prerequisites: ['FRAC.EQUAL'],
    lessonRef: 'lesson-frac-compare',
    visualKinds: ['fraction-bar', 'number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-frac-equiv',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.EQUIV',
    name: 'Find an equivalent fraction',
    band: 'middle',
    prerequisites: ['FRAC.EQUAL', 'MUL.FACT.10'],
    lessonRef: 'lesson-frac-equiv',
    visualKinds: ['fraction-bar', 'number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-frac-add-like',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.ADD.LIKE',
    name: 'Add and take away fractions with the same denominator',
    band: 'middle',
    prerequisites: ['FRAC.EQUAL'],
    lessonRef: 'lesson-frac-add-like',
    visualKinds: ['fraction-bar', 'number-line'],
    mode: 'number_sense',
  },
  {
    id: 'skill-frac-mul-whole',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.MUL.WHOLE',
    name: 'Multiply a fraction by a whole number',
    band: 'middle',
    prerequisites: ['FRAC.ADD.LIKE', 'MUL.FACT.10'],
    lessonRef: 'lesson-frac-mul-whole',
    visualKinds: ['fraction-bar'],
    mode: 'number_sense',
  },
  {
    id: 'skill-frac-add-unlike',
    subject: 'arithmetic',
    strand: 'fractions',
    code: 'FRAC.ADD.UNLIKE',
    name: 'Add and take away fractions with different denominators',
    band: 'middle',
    prerequisites: ['FRAC.ADD.LIKE', 'FRAC.EQUIV'],
    lessonRef: 'lesson-frac-add-unlike',
    visualKinds: ['fraction-bar'],
    mode: 'procedure',
  },
] as const satisfies readonly Skill[];
