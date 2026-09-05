import type { VisualKind } from './visual';
import type { Band, Grade } from '../band/band';

/**
 * The subjects a skill can belong to.
 *
 * The first three are the rewrite's authored inventory. The rest are the catalogue subjects
 * (`apps/api/src/curriculum/catalogue`): the four legacy curricula carried across whole, plus
 * the California-aligned subjects that fill TK–8 — each the subject name slugified the way
 * the legacy seeder did it, so a bookmark from the old app still names the same class.
 */
export type SkillSubject =
  | 'arithmetic'
  | 'reading'
  | 'writing'
  | 'mathematics'
  | 'english-writing'
  | 'english-reading'
  | 'math-adventures'
  | 'science'
  | 'history-social-science';

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
   *
   * `null` for a catalogue topic: nobody has written its note yet, and the tutor teaches it
   * from `objectives` instead. A catalogue topic is never proven by a checker, so it never
   * carries the `arithmetic` subject.
   */
  lessonRef: string | null;
  /** The visual models this skill may be shown with; empty where a picture would not help. */
  visualKinds: readonly VisualKind[];
  /** Catalogue topics only: the grade the legacy curriculum filed this topic under. */
  grade?: Grade;
  /** Catalogue topics only: the unit and lesson names, for the prompt and the parent. */
  unit?: string;
  lesson?: string;
  /** Catalogue topics only: the legacy learning objectives, verbatim. */
  objectives?: readonly string[];
  /** Catalogue topics only: teaching order within the subject and grade. */
  ordering?: number;
}>;
