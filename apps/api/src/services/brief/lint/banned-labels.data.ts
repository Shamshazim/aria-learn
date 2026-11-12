/**
 * Words a learner brief never uses about a child (P3-03, `master-plan.md` §4.2: the brief
 * "describes, never judges"). Labels, diagnoses and scores: each one reads as a verdict on the
 * child rather than a description of their week, and a parent cannot argue with a verdict.
 */
export const BANNED_LABELS: readonly string[] = [
  'gifted',
  'genius',
  'talented',
  'slow',
  'lazy',
  'struggling student',
  'below average',
  'above average',
  'advanced for',
  'adhd',
  'autistic',
  'autism',
  'dyslexic',
  'dyslexia',
  'dyscalculia',
  'disorder',
  'diagnosis',
  'diagnosed',
  'learning disability',
  'special needs',
  'iq',
  'percentile',
];

/** "Behind" is a label only as a verdict on the child: "is behind", "falling behind in maths". */
export const LABEL_PATTERNS: readonly RegExp[] = [
  /\b(?:is|are|was|falling|fallen|fell|gets?|got|running)\s+behind\b/iu,
  /\bbehind\s+(?:in|at|with)\b/iu,
  /\bbehind\s+(?:her|his|their|the)\s+(?:class|grade|peers|year|age)\b/iu,
];

/** Scores and grades in any form: "85%", "a B+", "grade A", "7/10". */
export const SCORE_PATTERNS: readonly RegExp[] = [
  /\d+(?:\.\d+)?\s*%/u,
  /\b\d+\s*(?:out of|\/)\s*\d+\b/u,
  /\b(?:grade|got an?|earned an?|scored an?)\s+[a-f][+-]?(?=\s|[.,!?]|$)/iu,
  /\b[a-f][+-](?=\s|[.,!?]|$)/u,
  /\bper ?cent\b/iu,
  /\bmastery\b/iu,
];
