import type { SkillSubject } from '@aria/shared';

/** The subject id a session route takes, for a skill's subject. */
export function subjectIdFor(subject: SkillSubject): string {
  return subject === 'arithmetic' ? 'math' : subject;
}

const NAMES: Readonly<Record<string, string>> = {
  math: 'Math',
  reading: 'Reading',
  writing: 'Writing',
  mathematics: 'Mathematics',
  'english-writing': 'English Writing',
  'math-adventures': 'Math Adventures',
  science: 'Science',
};

/** The name on the card, as the legacy curriculum spelled it. */
export function subjectName(subjectId: string): string {
  return NAMES[subjectId] ?? subjectId.charAt(0).toUpperCase() + subjectId.slice(1);
}
