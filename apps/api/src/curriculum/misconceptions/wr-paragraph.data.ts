import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A paragraph fails by being one sentence, one comma chain, or a list with no reasons. */
export const WR_PARAGRAPH_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-wr-paragraph-single-sentence',
    skillCode: 'WR.PARAGRAPH',
    name: 'Writes one sentence and stops',
    signature: 'The paragraph contains at most one sentence-ending mark',
    remediation: 'That is your point. Now give me two sentences that back it up.',
    approach: 'worked-example',
    model: 'a point plus two reasons plus a closing sentence, planned as four phrases',
    detects: { kind: 'pattern', pattern: '^[^.!?]*[.!?]?$' },
  },
  {
    id: 'misconception-wr-paragraph-comma-splice',
    skillCode: 'WR.PARAGRAPH',
    name: 'Joins the sentences with commas',
    signature: 'Three or more commas run the sentences together',
    remediation: 'Read it aloud. Where you take a breath, that is a full stop.',
    approach: 'worked-example',
    model: 'the paragraph read aloud, full stops placed at every breath',
    detects: { kind: 'pattern', pattern: ',[^.!?]*,[^.!?]*,' },
  },
  {
    id: 'misconception-wr-paragraph-no-reasons',
    skillCode: 'WR.PARAGRAPH',
    name: 'Gives detail without saying why it matters',
    signature: 'The paragraph contains no reason word linking detail to the point',
    remediation: 'You told me what. Now tell me why, using because.',
    approach: 'simpler-case',
    model: 'one detail and the because that follows it',
    detects: {
      kind: 'pattern',
      pattern: '^(?!.*\\b(?:because|so|since|that is why|which means)\\b).*$',
    },
  },
];
