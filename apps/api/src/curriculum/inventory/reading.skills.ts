import type { Skill } from '@aria/shared';

/** Representative early-reading skills from phonological awareness through comprehension. */
export const READING_SKILLS = [
  {
    id: 'skill-pa-rhyme',
    subject: 'reading',
    strand: 'phonological-awareness',
    code: 'PA.RHYME',
    name: 'Hear rhyme',
    band: 'early',
    prerequisites: [],
  },
  {
    id: 'skill-pa-blend',
    subject: 'reading',
    strand: 'phonological-awareness',
    code: 'PA.BLEND',
    name: 'Blend three sounds into a word',
    band: 'early',
    prerequisites: [],
  },
  {
    id: 'skill-ph-cvc',
    subject: 'reading',
    strand: 'phonics',
    code: 'PH.CVC',
    name: 'Decode consonant-vowel-consonant words',
    band: 'early',
    prerequisites: ['PA.BLEND'],
  },
  {
    id: 'skill-ph-silent-e',
    subject: 'reading',
    strand: 'phonics',
    code: 'PH.SILENT_E',
    name: 'Decode words with silent e',
    band: 'early',
    prerequisites: ['PH.CVC'],
  },
  {
    id: 'skill-fl-wcpm-60',
    subject: 'reading',
    strand: 'fluency',
    code: 'FL.WCPM.60',
    name: 'Read a decodable passage at 60 words per minute',
    band: 'early',
    prerequisites: ['PH.SILENT_E'],
  },
  {
    id: 'skill-cmp-retell',
    subject: 'reading',
    strand: 'comprehension',
    code: 'CMP.RETELL',
    name: 'Retell a short story',
    band: 'early',
    prerequisites: [],
  },
] as const satisfies readonly Skill[];
