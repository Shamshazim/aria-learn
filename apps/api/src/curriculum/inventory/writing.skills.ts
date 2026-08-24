import type { Skill } from '@aria/shared';

/** Four reviewable steps that represent the writing ladder without becoming a curriculum. */
export const WRITING_SKILLS = [
  {
    id: 'skill-wr-word',
    subject: 'writing',
    strand: 'composition',
    code: 'WR.WORD',
    name: 'Write one word for an idea',
    band: 'early',
    prerequisites: [],
  },
  {
    id: 'skill-wr-sentence',
    subject: 'writing',
    strand: 'composition',
    code: 'WR.SENTENCE',
    name: 'Write one complete sentence',
    band: 'early',
    prerequisites: ['WR.WORD'],
  },
  {
    id: 'skill-wr-paragraph',
    subject: 'writing',
    strand: 'composition',
    code: 'WR.PARAGRAPH',
    name: 'Write a focused paragraph',
    band: 'middle',
    prerequisites: ['WR.SENTENCE'],
  },
  {
    id: 'skill-wr-short-piece',
    subject: 'writing',
    strand: 'composition',
    code: 'WR.SHORT_PIECE',
    name: 'Write a short piece with a beginning, middle, and end',
    band: 'senior',
    prerequisites: ['WR.PARAGRAPH'],
  },
] as const satisfies readonly Skill[];
