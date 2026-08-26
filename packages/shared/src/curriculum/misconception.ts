/**
 * How a `RETEACH` addresses a wrong idea (P2H-10).
 *
 * The three planner approaches for `RETEACH`, plus `worked-example`, which the teaching policy
 * reaches for on its own when a visual model has already been tried. A misconception names one
 * because the fix is not generic: a child who added each column independently needs to see ten
 * ones traded for a ten, and telling them the same sentence again more slowly will not do it.
 */
export type RemediationApproach =
  | 'visual-model'
  | 'concrete-story'
  | 'simpler-case'
  | 'worked-example';

/** A recognisable wrong idea and the concrete teaching response that addresses it. */
export type Misconception = Readonly<{
  id: string;
  skillCode: string;
  name: string;
  signature: string;
  remediation: string;
  /** Which kind of reteach this wrong idea needs. */
  approach: RemediationApproach;
  /** The concrete thing to put in front of the child, named so a `SHOW` can caption it. */
  model: string;
}>;
