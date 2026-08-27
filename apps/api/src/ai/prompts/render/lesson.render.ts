import type { LessonNote } from '@/curriculum';

/**
 * The teaching note, compressed into the block a persona prompt is grounded in (P2H-10).
 *
 * Before this, a prompt was told the skill was `ADD.REGROUP.2D` and had to invent everything
 * else. This is the difference between a general explanation of addition and this skill's
 * explanation: the one idea to land, the models a child can be shown, and — the part a model
 * will otherwise get wrong every time — the adult vocabulary not to use.
 */
export function renderLessonGrounding(note: LessonNote | null): string {
  if (note === null) return '';
  return [
    'What you know about this skill:',
    `- It is: ${note.whatItIs}`,
    `- The one idea: ${note.oneIdea}`,
    `- Common stumbles: ${note.stumbles.join(' ')}`,
    `- Models you may use: ${note.models.join(' ')}`,
    `- A worked example: ${note.workedExample}`,
    `- Words to use: ${note.useLanguage.join(', ')}`,
    `- Words to avoid: ${note.avoidLanguage.join(', ')}`,
  ].join('\n');
}
