import { describe, expect, it } from 'vitest';

import { scrubLearnerContext } from '@/privacy/scrub';

describe('pseudonymous first name', () => {
  it('shares the real first name only, never the surname (P2H-04 decision)', () => {
    const scrubbed = scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        pseudonymousFirstName: 'Priya',
        recentDialogue: [{ speaker: 'child', text: 'Priya likes cats and Shah is the family' }],
      },
      { pseudonym: 'include' },
    );

    expect(scrubbed.value.pseudonymousFirstName).toBe('Priya');
    expect(scrubbed.categories).toContain('pseudonymous_first_name');
    expect(scrubbed.categories).toContain('recent_dialogue');
    const text = scrubbed.value.recentDialogue?.[0]?.text ?? '';
    expect(text).not.toContain('Shah');
    expect(text).toContain('Priya');
  });

  it('still redacts the first name when the caller omits the pseudonym', () => {
    const scrubbed = scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        recentDialogue: [{ speaker: 'child', text: 'Priya likes cats' }],
      },
      { pseudonym: 'omit' },
    );

    expect(scrubbed.value.recentDialogue?.[0]?.text).not.toContain('Priya');
  });

  it('rejects a two-letter real first name used as a pseudonym', () => {
    const scrubbed = scrubLearnerContext(
      {
        identifiers: { fullName: 'Li Wei' },
        pseudonymousFirstName: 'Li',
      },
      { pseudonym: 'include' },
    );

    expect(scrubbed.value.pseudonymousFirstName).toBeUndefined();
  });

  it('includes a safe pseudonym only when the caller explicitly chooses it', () => {
    const raw = {
      identifiers: { fullName: 'Priya Shah' },
      pseudonymousFirstName: 'Nova',
    } as const;

    const included = scrubLearnerContext(raw, { pseudonym: 'include' });
    const omitted = scrubLearnerContext(raw, { pseudonym: 'omit' });

    expect(included.value.pseudonymousFirstName).toBe('Nova');
    expect(included.categories).toContain('pseudonymous_first_name');
    expect(omitted.value.pseudonymousFirstName).toBeUndefined();
    expect(omitted.categories).not.toContain('pseudonymous_first_name');
  });
});
