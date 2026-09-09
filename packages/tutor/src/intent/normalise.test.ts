import { describe, expect, it } from 'vitest';

import { foldForMatching } from './normalise';
import { classifyIntent } from './rules';

/**
 * X-05: "homoglyph and NFKC variants of personal-info requests hit the deterministic path".
 *
 * The assertions are on `classifyIntent` rather than on the folding, because the folding is
 * only worth anything if the rule downstream of it fires. A test of the fold alone would pass
 * on the day somebody stopped calling it.
 */
const HINTS = { answerKey: '7' } as const;

describe('a disclosure dressed up so the patterns miss it', () => {
  it.each([
    ['plain', 'my address is 14 Maple Street'],
    ['cyrillic а and е', 'my аddrеss is 14 Maple Street'],
    ['full-width', 'ｍｙ ａｄｄｒｅｓｓ ｉｓ 14 Maple Street'],
    ['zero-width joiners', 'my a​d‌d‍ress is 14 Maple Street'],
    ['accented', 'my áddréss is 14 Maple Street'],
    ['non-breaking spaces', 'my address is 14 Maple Street'],
    ['shouted', 'MY ADDRESS IS 14 Maple Street'],
    ['curly apostrophe in a name offer', 'my name is O’Brien Smith'],
  ])('is still read as personal information: %s', (_name, text) => {
    expect(classifyIntent(text, HINTS).intent).toBe('PERSONAL_INFO');
  });

  it('reads a homoglyph phone number as personal information', () => {
    expect(classifyIntent('my numbеr is 555 123 4567', HINTS).intent).toBe('PERSONAL_INFO');
  });

  /** The fold must not turn ordinary work into a disclosure, or every child pays for it. */
  it.each(['seven', '7', 'i think the answer is 7', 'i have a cat named Maple'])(
    'leaves ordinary text alone: %s',
    (text) => {
      expect(classifyIntent(text, HINTS).intent).not.toBe('PERSONAL_INFO');
    },
  );

  it('still finds the answer inside a full-width transcript', () => {
    expect(classifyIntent('７', HINTS).intent).toBe('ANSWER');
  });

  it('treats a message made only of invisible characters as unclear', () => {
    expect(classifyIntent('​​﻿', HINTS)).toMatchObject({
      intent: 'UNCLEAR',
      matchedRule: 'empty',
    });
  });
});

describe('the fold itself', () => {
  it('is idempotent, so folding a folded string changes nothing', () => {
    const once = foldForMatching('MY ÁDDRЕSS is 14 Maple Street');

    expect(foldForMatching(once)).toBe(once);
  });

  it('leaves the digits a grader compares intact', () => {
    expect(foldForMatching('42')).toBe('42');
  });
});
