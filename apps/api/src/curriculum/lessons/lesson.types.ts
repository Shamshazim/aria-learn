/**
 * A teaching note: what Aria knows about a skill before she opens her mouth (P2H-10).
 *
 * `SAY` and `RETEACH` are grounded in this, not in the skill code. A prompt that receives
 * `ADD.REGROUP.2D` can only produce a general-purpose explanation; one that receives the
 * models, the stumbles and the words to avoid can produce this skill's explanation.
 */
export type LessonReview = Readonly<{
  status: 'pending' | 'approved';
  reviewer?: string | undefined;
  reviewedAt?: string | undefined;
}>;

export type LessonNote = Readonly<{
  /** Matches the owning skill's `lessonRef`; a mismatch fails the loader. */
  id: string;
  skillCode: string;
  review: LessonReview;
  whatItIs: string;
  oneIdea: string;
  stumbles: readonly string[];
  /** Exactly two, because a child who does not see the first one needs a different one. */
  models: readonly string[];
  workedExample: string;
  useLanguage: readonly string[];
  avoidLanguage: readonly string[];
}>;
