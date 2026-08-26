import type { VisualKind } from './visual';
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
  /**
   * P2H-10: the teaching note this skill is explained from.
   *
   * The note declares the same id, so a note that is renamed or filed under the wrong skill
   * fails the loader instead of quietly grounding an explanation in the wrong lesson.
   */
  lessonRef: string;
  /** The visual models this skill may be shown with; empty where a picture would not help. */
  visualKinds: readonly VisualKind[];
}>;
