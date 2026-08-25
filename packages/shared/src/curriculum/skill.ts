import type { Band } from '../band/band';

export type SkillSubject = 'arithmetic' | 'reading' | 'writing';

/** The smallest authored curriculum capability Aria can teach or measure. */
export type Skill = Readonly<{
  id: string;
  subject: SkillSubject;
  strand: string;
  code: string;
  name: string;
  band: Band;
  prerequisites: readonly string[];
}>;
