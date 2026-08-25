import { describe, expect, it } from 'vitest';

import { scrubLearnerContext } from '@/privacy/scrub';

describe('pseudonymous first name', () => {
  it('does not treat the learner real first name as a pseudonym', () => {
    const scrubbed = scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        pseudonymousFirstName: 'Priya',
      },
      { pseudonym: 'include' },
    );

    expect(scrubbed.value.pseudonymousFirstName).toBeUndefined();
    expect(scrubbed.categories).not.toContain('pseudonymous_first_name');
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
