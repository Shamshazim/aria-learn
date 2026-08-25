import { describe, expect, it } from 'vitest';

import { PARENT_DISCLOSURE, parentDisclosureFor } from '@/privacy/disclosure/categories';
import { scrubLearnerContext } from '@/privacy/scrub';
import type { ContextCategory } from '@/privacy/types';

const ALL_CATEGORIES: readonly ContextCategory[] = [
  'grade_band',
  'learner_memory',
  'pseudonymous_first_name',
  'recent_dialogue',
  'recent_evidence',
  'skill',
];

describe('parent disclosure', () => {
  it('explains every category of context that can reach a vendor', () => {
    expect(Object.keys(PARENT_DISCLOSURE).sort()).toEqual([...ALL_CATEGORIES].sort());
    for (const entry of Object.values(PARENT_DISCLOSURE)) {
      expect(entry.label.length, entry.key).toBeGreaterThan(0);
      expect(entry.description.length, entry.key).toBeGreaterThan(20);
    }
  });

  it('lists first_name and recent_dialogue for a session that sends both (P2H-04)', () => {
    const context = scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        pseudonymousFirstName: 'Priya',
        recentDialogue: [{ speaker: 'child', text: 'I got seven.' }],
      },
      { pseudonym: 'include' },
    );

    expect(parentDisclosureFor(context.categories).map((entry) => entry.key)).toEqual([
      'first_name',
      'recent_dialogue',
    ]);
  });

  it('names the first name as first_name, not by its internal category', () => {
    expect(PARENT_DISCLOSURE.pseudonymous_first_name.key).toBe('first_name');
    expect(PARENT_DISCLOSURE.pseudonymous_first_name.description).toContain('first name only');
  });

  it('tells a parent what happens to a flagged turn', () => {
    expect(PARENT_DISCLOSURE.recent_dialogue.description).toContain('safety');
  });

  it('lists nothing for a context that shares nothing', () => {
    const context = scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' });

    expect(parentDisclosureFor(context.categories)).toEqual([]);
  });
});
