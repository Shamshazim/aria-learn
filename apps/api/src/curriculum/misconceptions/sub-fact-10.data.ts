import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Taking away goes wrong by adding, by counting the start, or by naming the part taken. */
export const SUB_FACT_10_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-sub-fact-10-added',
    skillCode: 'SUB.FACT.10',
    name: 'Adds instead of taking away',
    signature: 'Answers with the sum of the two numbers',
    remediation: 'Take away means the pile gets smaller. Start with them all, then remove some.',
    approach: 'concrete-story',
    model: 'a pile of counters with some lifted away',
    detects: { kind: 'derived', rule: 'added-instead' },
  },
  {
    id: 'misconception-sub-fact-10-counted-start',
    skillCode: 'SUB.FACT.10',
    name: 'Counts the start when counting back',
    signature: 'Says the starting number as the first step back, so the answer is one too many',
    remediation:
      'Put your finger on the start. Each jump back is one. Do not count where you began.',
    approach: 'visual-model',
    model: 'a number line with jumps drawn back from the starting number',
    detects: { kind: 'derived', rule: 'counted-back-including-start' },
  },
  {
    id: 'misconception-sub-fact-10-names-the-part',
    skillCode: 'SUB.FACT.10',
    name: 'Answers with the part taken away',
    signature: 'Gives the number being subtracted rather than what is left',
    remediation: 'The question asks what is left. Count the counters still on the table.',
    approach: 'visual-model',
    model: 'a ten-frame with the taken counters crossed out',
    detects: { kind: 'derived', rule: 'answered-the-part' },
  },
];
