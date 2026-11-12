import { foldForMatching } from './normalise';

/**
 * A child correcting what Aria knows about them (P3-06): "I don't like trucks anymore", "my
 * dog is called Rex now", "I'm in grade 3 now".
 *
 * Deterministic patterns, like every other rule in `intent/`. What they find is only a claim:
 * the API decides whether it matches anything Aria actually remembers, and a grade is never
 * changed from here — a child's grade is their grown-up's to set.
 */
export type SelfCorrection =
  | Readonly<{ kind: 'stopped_liking'; thing: string }>
  | Readonly<{ kind: 'renamed'; relation: string; name: string }>
  | Readonly<{ kind: 'grade'; grade: string }>;

const RELATIONS = String.raw`(dog|puppy|cat|kitten|fish|hamster|rabbit|bunny|guinea pig|bird|turtle|pet|brother|sister|baby)`;

const STOPPED_LIKING = [
  /\bi (?:don'?t|do not|dont|no longer) (?:like|love|enjoy|want) (.{2,40}?) (?:any ?more|now)\b/u,
  /\bi'?m not (?:into|a fan of) (.{2,40}?) (?:any ?more|now)\b/u,
];
const RENAMED = new RegExp(
  String.raw`\bmy (?:new )?${RELATIONS}(?:'s name)? is (?:called |named )?([a-z][a-z-]{1,19}) now\b`,
  'u',
);
const GRADE = /\bi'?m in (?:grade |year )?(tk|k|[1-8])(?:st|nd|rd|th)?(?: grade)? now\b/u;

export function selfCorrection(text: string): SelfCorrection | null {
  const folded = foldForMatching(text).toLowerCase().replace(/[’‘]/gu, "'");
  for (const pattern of STOPPED_LIKING) {
    const thing = clean(pattern.exec(folded)?.[1]);
    if (thing !== null) return { kind: 'stopped_liking', thing };
  }
  const renamed = RENAMED.exec(folded);
  if (renamed?.[1] !== undefined && renamed[2] !== undefined) {
    return { kind: 'renamed', relation: renamed[1], name: renamed[2] };
  }
  const grade = GRADE.exec(folded)?.[1];
  return grade === undefined ? null : { kind: 'grade', grade };
}

/** "the trucks" → "trucks"; anything left that is not plain words is not a thing we repeat. */
function clean(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const thing = raw.replace(/^(?:the|my|playing|doing|reading about) /u, '').trim();
  return /^[a-z][a-z' -]{1,39}$/u.test(thing) ? thing : null;
}
