import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

/**
 * One true positive and one true negative for every authored misconception (P2H-10).
 *
 * The table is the test. A signature that recognises nothing is useless and a signature that
 * recognises the right answer is worse than useless, so both halves are required for every
 * entry, and `misconceptions.test.ts` fails if any authored id is missing from this table.
 */
export type SignatureCase = Readonly<{
  id: string;
  /** An answer that carries the wrong idea. */
  positive: MisconceptionInput;
  /** An answer that does not — usually the correct one. */
  negative: MisconceptionInput;
}>;

const SEQ_20: ArithmeticProblem = {
  skillCode: 'NUM.CNT.20',
  kind: 'sequence',
  values: ['17', '18', '19'],
  step: '1',
};
const SEQ_5: ArithmeticProblem = {
  skillCode: 'NUM.CNT.SKIP5',
  kind: 'sequence',
  values: ['5', '10', '15'],
  step: '5',
};
const FACT: ArithmeticProblem = {
  skillCode: 'ADD.FACT.10',
  kind: 'addition',
  left: '7',
  right: '3',
};
const REGROUP: ArithmeticProblem = {
  skillCode: 'ADD.REGROUP.2D',
  kind: 'addition',
  left: '48',
  right: '37',
};
const EQUIVALENT: ArithmeticProblem = {
  skillCode: 'FRAC.EQUAL',
  kind: 'fraction-equality',
  left: '1/2',
  right: '2/4',
};
const SAME_TOP: ArithmeticProblem = {
  skillCode: 'FRAC.EQUAL',
  kind: 'fraction-equality',
  left: '1/3',
  right: '1/4',
};
const SAME_BOTTOM: ArithmeticProblem = {
  skillCode: 'FRAC.EQUAL',
  kind: 'fraction-equality',
  left: '1/4',
  right: '3/4',
};
const UNLIKE: ArithmeticProblem = {
  skillCode: 'FRAC.COMPARE',
  kind: 'fraction-comparison',
  left: '1/3',
  right: '1/8',
};
const LIKE: ArithmeticProblem = {
  skillCode: 'FRAC.COMPARE',
  kind: 'fraction-comparison',
  left: '5/8',
  right: '3/8',
};

const PARAGRAPH =
  'dogs make good pets. they are loyal because they stay near you. that is why a dog is a good first pet.';
const PIECE = 'the box was on the step. then it opened. in the end the box was back on the step.';
const PASSAGE = 'the cat sat on the mat';
const RETELL = 'first the cat sat then the dog came last the cat ran out';

function on(
  skillCode: string,
  question: string | null,
  expectedAnswer: string | null,
  problem: ArithmeticProblem | null,
) {
  return (learnerAnswer: string): MisconceptionInput => ({
    skillCode,
    question,
    expectedAnswer,
    learnerAnswer,
    problem,
  });
}

const count20 = on('NUM.CNT.20', '17, 18, 19. What is next?', '20', SEQ_20);
const skip5 = on('NUM.CNT.SKIP5', '5, 10, 15. What is next?', '20', SEQ_5);
const fact = on('ADD.FACT.10', 'What is seven add three?', '10', FACT);
const regroup = on('ADD.REGROUP.2D', 'What is 48 add 37?', '85', REGROUP);
const equivalent = on('FRAC.EQUAL', 'Are 1/2 and 2/4 equal?', 'equal', EQUIVALENT);
const sameTop = on('FRAC.EQUAL', 'Are 1/3 and 1/4 equal?', 'not equal', SAME_TOP);
const sameBottom = on('FRAC.EQUAL', 'Are 1/4 and 3/4 equal?', 'not equal', SAME_BOTTOM);
const unlike = on('FRAC.COMPARE', 'Compare 1/3 and 1/8.', '>', UNLIKE);
const like = on('FRAC.COMPARE', 'Compare 5/8 and 3/8.', '>', LIKE);
const rhyme = on('PA.RHYME', 'Which word rhymes with cat?', 'hat', null);
const blend = on('PA.BLEND', 'What word is c, a, t?', 'cat', null);
const cvc = on('PH.CVC', 'Read cat.', 'cat', null);
const silentE = on('PH.SILENT_E', 'Read cape.', 'cape', null);
const shortWord = on('PH.SILENT_E', 'Read bed.', 'bed', null);
const fluency = on('FL.WCPM.60', 'Read the passage aloud.', PASSAGE, null);
const retell = on('CMP.RETELL', 'What happened in the story?', RETELL, null);
const word = on('WR.WORD', 'Write one word for a big dog.', 'dog', null);
const sentence = on('WR.SENTENCE', 'Write one sentence.', 'the dog ran fast.', null);
const paragraph = on('WR.PARAGRAPH', 'Write one paragraph about pets.', PARAGRAPH, null);
const piece = on('WR.SHORT_PIECE', 'Write a short piece about a box.', PIECE, null);

export const SIGNATURE_CASES: readonly SignatureCase[] = [
  { id: 'misconception-num-cnt-20-restart', positive: count20('17'), negative: count20('20') },
  { id: 'misconception-num-cnt-20-repeats-last', positive: count20('19'), negative: count20('20') },
  { id: 'misconception-num-cnt-20-skips-a-teen', positive: count20('21'), negative: count20('20') },
  { id: 'misconception-num-cnt-skip5-by-one', positive: skip5('16'), negative: skip5('20') },
  { id: 'misconception-num-cnt-skip5-restart', positive: skip5('5'), negative: skip5('20') },
  { id: 'misconception-num-cnt-skip5-repeats-last', positive: skip5('15'), negative: skip5('20') },
  { id: 'misconception-add-fact-10-off-by-one-short', positive: fact('9'), negative: fact('10') },
  { id: 'misconception-add-fact-10-names-an-operand', positive: fact('7'), negative: fact('10') },
  { id: 'misconception-add-fact-10-subtracted', positive: fact('4'), negative: fact('10') },
  { id: 'misconception-add-regroup-no-carry', positive: regroup('715'), negative: regroup('85') },
  {
    id: 'misconception-add-regroup-dropped-carry',
    positive: regroup('75'),
    negative: regroup('85'),
  },
  {
    id: 'misconception-add-regroup-carried-ones-digit',
    positive: regroup('121'),
    negative: regroup('85'),
  },
  {
    id: 'misconception-frac-equal-different-numerals',
    positive: equivalent('not equal'),
    negative: equivalent('equal'),
  },
  {
    id: 'misconception-frac-equal-same-numerator',
    positive: sameTop('equal'),
    negative: sameTop('not equal'),
  },
  {
    id: 'misconception-frac-equal-same-denominator',
    positive: sameBottom('equal'),
    negative: sameBottom('not equal'),
  },
  { id: 'misconception-frac-compare-denominator', positive: unlike('<'), negative: unlike('>') },
  {
    id: 'misconception-frac-compare-same-numerator',
    positive: unlike('='),
    negative: unlike('>'),
  },
  { id: 'misconception-frac-compare-reversed', positive: like('<'), negative: like('>') },
  { id: 'misconception-pa-rhyme-initial-sound', positive: rhyme('cup'), negative: rhyme('hat') },
  { id: 'misconception-pa-rhyme-semantic-match', positive: rhyme('dog'), negative: rhyme('hat') },
  {
    id: 'misconception-pa-rhyme-echoes-prompt',
    positive: rhyme('which word rhymes with cat'),
    negative: rhyme('hat'),
  },
  {
    id: 'misconception-pa-blend-says-the-sounds',
    positive: blend('c a t'),
    negative: blend('cat'),
  },
  { id: 'misconception-pa-blend-drops-the-middle', positive: blend('ct'), negative: blend('cat') },
  {
    id: 'misconception-pa-blend-first-sound-guess',
    positive: blend('cup'),
    negative: blend('cat'),
  },
  { id: 'misconception-ph-cvc-letter-names', positive: cvc('see ay tee'), negative: cvc('cat') },
  { id: 'misconception-ph-cvc-first-letter-guess', positive: cvc('cup'), negative: cvc('cat') },
  { id: 'misconception-ph-cvc-vowel-swap', positive: cvc('cot'), negative: cvc('cat') },
  {
    id: 'misconception-ph-silent-e-short-vowel',
    positive: silentE('cap'),
    negative: silentE('cape'),
  },
  { id: 'misconception-ph-silent-e-spoken', positive: silentE('capee'), negative: silentE('cape') },
  {
    id: 'misconception-ph-silent-e-overapplied',
    positive: shortWord('bede'),
    negative: shortWord('bed'),
  },
  {
    id: 'misconception-fl-wcpm-60-substitution',
    positive: fluency('the cat sat on the man'),
    negative: fluency(PASSAGE),
  },
  {
    id: 'misconception-fl-wcpm-60-restarts',
    positive: fluency('the the cat sat on the mat'),
    negative: fluency(PASSAGE),
  },
  {
    id: 'misconception-fl-wcpm-60-skips-words',
    positive: fluency('the cat sat on the'),
    negative: fluency(PASSAGE),
  },
  {
    id: 'misconception-cmp-retell-no-sequence',
    positive: retell('the cat and the dog'),
    negative: retell(RETELL),
  },
  {
    id: 'misconception-cmp-retell-ending-first',
    positive: retell('last the cat ran out'),
    negative: retell(RETELL),
  },
  {
    id: 'misconception-cmp-retell-echoes-question',
    positive: retell('what happened in the story'),
    negative: retell(RETELL),
  },
  { id: 'misconception-wr-word-no-vowel', positive: word('dg'), negative: word('dog') },
  {
    id: 'misconception-wr-word-copies-prompt',
    positive: word('write one word for a big dog'),
    negative: word('dog'),
  },
  { id: 'misconception-wr-word-letter-run', positive: word('dddog'), negative: word('dog') },
  {
    id: 'misconception-wr-sentence-no-end-mark',
    positive: sentence('the dog ran fast'),
    negative: sentence('the dog ran fast.'),
  },
  {
    id: 'misconception-wr-sentence-run-on',
    positive: sentence('i ran and i sat and i ate and i left.'),
    negative: sentence('the dog ran fast.'),
  },
  {
    id: 'misconception-wr-sentence-no-verb',
    positive: sentence('the big red dog.'),
    negative: sentence('the dog ran fast.'),
  },
  {
    id: 'misconception-wr-paragraph-single-sentence',
    positive: paragraph('dogs are good pets.'),
    negative: paragraph(PARAGRAPH),
  },
  {
    id: 'misconception-wr-paragraph-comma-splice',
    positive: paragraph('dogs are loyal, they get you out, they are fun, that is why.'),
    negative: paragraph(PARAGRAPH),
  },
  {
    id: 'misconception-wr-paragraph-no-reasons',
    positive: paragraph('dogs are loyal. dogs are fun. dogs are quiet.'),
    negative: paragraph(PARAGRAPH),
  },
  {
    id: 'misconception-wr-short-piece-no-ending',
    positive: piece('the box was on the step. then it opened.'),
    negative: piece(PIECE),
  },
  {
    id: 'misconception-wr-short-piece-dream-ending',
    positive: piece('then i woke up.'),
    negative: piece(PIECE),
  },
  {
    id: 'misconception-wr-short-piece-all-setting',
    positive: piece('the box was blue and old and quiet.'),
    negative: piece(PIECE),
  },
];
