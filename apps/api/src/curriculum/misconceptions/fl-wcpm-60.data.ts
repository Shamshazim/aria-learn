import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Fluency breaks down as substitution, restarting, or skipping, and each is visible in the transcript. */
export const FL_WCPM_60_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-fl-wcpm-60-substitution',
    skillCode: 'FL.WCPM.60',
    name: 'Substitutes a word that starts the same',
    signature: 'Reads a different word that shares the opening letters',
    remediation: 'You read the start right. Go back and read the whole word.',
    detects: { kind: 'shares-key-prefix', length: 2 },
  },
  {
    id: 'misconception-fl-wcpm-60-restarts',
    skillCode: 'FL.WCPM.60',
    name: 'Restarts the same words repeatedly',
    signature: 'The transcript repeats a word immediately after itself',
    remediation: 'Read to the end of the sentence. Then go back.',
    detects: { kind: 'pattern', pattern: '\\b(\\w+)\\s+\\1\\b' },
  },
  {
    id: 'misconception-fl-wcpm-60-skips-words',
    skillCode: 'FL.WCPM.60',
    name: 'Skips words to keep the pace up',
    signature: 'The transcript is short of the passage by whole words',
    remediation: 'Slow down enough to say every word. Smooth is not the same as fast.',
    detects: { kind: 'derived', rule: 'shorter-than-key' },
  },
];
