import { foldForMatching } from '@aria/tutor';

import { containsSensitiveDisclosure } from '@/safety';

/**
 * The categories no durable memory may hold (`master-plan.md` §12.4: "if a child volunteers
 * something sensitive, it is not promoted into durable learner memory"). The list is P3-02's
 * — health, family conflict, body, religion, immigration status, money — written here first
 * because P3-06 needs it: a parent may retract sensitive content, never add it as a fact.
 *
 * Patterns, deliberately broad. A false positive costs a parent one rephrasing; a false
 * negative puts a diagnosis into every prompt Aria is given from then on. Words a lesson uses
 * every day are left out on purpose — "add", "period", "argue" — so a fact about learning is
 * never mistaken for one about a family.
 */
export type SensitiveCategory =
  'health' | 'family_conflict' | 'body' | 'religion' | 'immigration' | 'money' | 'disclosure';

const CATEGORIES: readonly (readonly [SensitiveCategory, RegExp])[] = [
  [
    'health',
    /\b(?:adhd|autis\w*|asperger\w*|dyslex\w*|dyspraxi\w*|diagnos\w*|disorder|disabilit\w*|medicat\w*|medicine|therap\w*|psychiatr\w*|psycholog\w*|anxiety|depress\w*|seizure\w*|epilep\w*|diabet\w*|asthma|allerg\w*|illness|hospital)\b/u,
  ],
  [
    'family_conflict',
    /\b(?:divorc\w*|separat\w*|custody|foster\w*|adopt\w*|prison|jail|arrest\w*|police)\b/u,
  ],
  ['body', /\b(?:weight|fat|skinny|overweight|underweight|puberty|body)\b/u],
  [
    'religion',
    /\b(?:church|mosque|temple|synagogue|religio\w*|pray\w*|god|allah|jesus|bible|quran|torah|christian|muslim|jewish|hindu|buddhist|atheist)\b/u,
  ],
  ['immigration', /\b(?:immigra\w*|visas?|refugees?|asylum|deport\w*|citizenship|undocumented)\b/u],
  ['money', /\b(?:money|poor|rich|debt|rent|benefits|welfare|salary|afford\w*|food bank)\b/u],
];

export function sensitiveCategory(text: string): SensitiveCategory | null {
  if (containsSensitiveDisclosure(text)) return 'disclosure';
  const folded = foldForMatching(text).toLowerCase();
  return CATEGORIES.find(([, pattern]) => pattern.test(folded))?.[0] ?? null;
}
