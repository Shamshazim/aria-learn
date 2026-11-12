import { foldForMatching } from '@aria/tutor';

import { judgementIn } from '@/services/memory/correct/judgement';

import { BANNED_LABELS, LABEL_PATTERNS, SCORE_PATTERNS } from './banned-labels.data';

/**
 * The brief lint (P3-03): deterministic, run after the model and before the write. Returns the
 * rules a body breaks, in words a regeneration prompt can be given; empty means it may be kept.
 * It shares P3-06's describe-never-judge patterns, so a parent's correction and Aria's own
 * paragraph are held to the same line.
 */
export function describeNotJudge(body: string): readonly string[] {
  const folded = ` ${foldForMatching(body)
    .toLowerCase()
    .replace(/[^a-z0-9%+/.' -]+/gu, ' ')} `;
  const violations: string[] = [];
  for (const label of BANNED_LABELS) {
    if (
      folded.includes(` ${label} `) ||
      folded.includes(` ${label}.`) ||
      folded.includes(` ${label},`)
    ) {
      violations.push(`uses the label "${label}"`);
    }
  }
  if (LABEL_PATTERNS.some((pattern) => pattern.test(body)))
    violations.push('calls the child "behind"');
  if (SCORE_PATTERNS.some((pattern) => pattern.test(body))) {
    violations.push('gives a score, percentage or grade');
  }
  if (judgementIn(body)) violations.push('judges the child instead of describing what happened');
  if (/\b[A-Z]{2,5}\.[A-Z0-9_.]+\b/u.test(body)) violations.push('names a skill by its code');
  return violations;
}
