import type { ContextCategory } from '@/privacy/types';

/**
 * What a parent is told we send to a model vendor (P0-23, P2H-04).
 *
 * The internal category names are for us; these are for a parent reading a settings screen at
 * nine at night. The list is exhaustive over `ContextCategory` by type, so a new kind of
 * context cannot reach a vendor without someone writing the sentence that explains it.
 */
export type ParentDisclosureEntry = Readonly<{
  /** The parent-facing key, stable across renames of the internal category. */
  key: string;
  category: ContextCategory;
  label: string;
  description: string;
}>;

export const PARENT_DISCLOSURE: Readonly<Record<ContextCategory, ParentDisclosureEntry>> = {
  grade_band: {
    key: 'grade_band',
    category: 'grade_band',
    label: 'Age range',
    description: 'A broad age range, so the tutor talks at the right level. Never a birthdate.',
  },
  skill: {
    key: 'skill',
    category: 'skill',
    label: 'What is being taught',
    description: 'The name of the skill being worked on, such as "adding with regrouping".',
  },
  recent_evidence: {
    key: 'recent_evidence',
    category: 'recent_evidence',
    label: 'How this session is going',
    description: 'Short notes about the last few answers, such as "answered 4, expected 7".',
  },
  learner_memory: {
    key: 'learner_memory',
    category: 'learner_memory',
    label: 'What the tutor remembers',
    description:
      'Facts you can see and delete in the memory list, such as "finds fractions hard". Anything you mark private is never sent.',
  },
  pseudonymous_first_name: {
    key: 'first_name',
    category: 'pseudonymous_first_name',
    label: 'First name',
    description:
      'Your child’s first name only, and only if you turned this on, so the tutor can use it. Never a surname.',
  },
  recent_dialogue: {
    key: 'recent_dialogue',
    category: 'recent_dialogue',
    label: 'The last few things said',
    description:
      'The most recent turns of this conversation, so the tutor can follow it. Names, addresses, schools and contact details are removed first, and anything our safety check flagged is removed entirely.',
  },
};

/** The entries for one generation, in the order a parent should read them. */
export function parentDisclosureFor(
  categories: readonly ContextCategory[],
): readonly ParentDisclosureEntry[] {
  return ORDER.filter((category) => categories.includes(category)).map(
    (category) => PARENT_DISCLOSURE[category],
  );
}

const ORDER: readonly ContextCategory[] = [
  'pseudonymous_first_name',
  'grade_band',
  'skill',
  'recent_dialogue',
  'recent_evidence',
  'learner_memory',
];
