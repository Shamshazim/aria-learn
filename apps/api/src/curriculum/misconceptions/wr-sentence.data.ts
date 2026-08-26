import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A sentence fails at its edges or at its verb. */
export const WR_SENTENCE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-wr-sentence-no-end-mark',
    skillCode: 'WR.SENTENCE',
    name: 'Leaves off the end punctuation',
    signature: 'The sentence does not finish with a full stop, question mark or exclamation mark',
    remediation: 'Where does the thought stop? Put a full stop there.',
    detects: { kind: 'pattern', pattern: '[^.!?]$' },
  },
  {
    id: 'misconception-wr-sentence-run-on',
    skillCode: 'WR.SENTENCE',
    name: 'Joins several thoughts with and',
    signature: 'The sentence contains three or more instances of and',
    remediation: 'That is three thoughts. Give each one its own sentence.',
    detects: { kind: 'pattern', pattern: '\\band\\b.*\\band\\b.*\\band\\b' },
  },
  {
    id: 'misconception-wr-sentence-no-verb',
    skillCode: 'WR.SENTENCE',
    name: 'Writes a list with nothing happening',
    signature: 'The sentence contains no recognisable verb',
    remediation: 'Who is in it, and what are they doing? The doing word is the one missing.',
    detects: {
      kind: 'pattern',
      pattern:
        '^(?!.*\\b(?:is|are|am|was|were|has|have|had|ran|sat|went|said|makes|make|made|gets|get|got|plays|play|likes|like|sees|see|saw)\\b).*$',
    },
  },
];
