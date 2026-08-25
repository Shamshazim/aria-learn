import { describe, expect, it } from 'vitest';

import { displayForm, hasProsody, markProsody, stripProsody } from './markers';

describe('prosody markers', () => {
  it('turns an author mark into a vendor-neutral token', () => {
    expect(markProsody('Count the *shapes*.')).toBe('Count the [[emphasis]]shapes[[/emphasis]].');
  });

  it('leaves multiplication alone: a mark hugs the word it emphasises', () => {
    expect(markProsody('2 * 3')).toBe('2 * 3');
  });

  it('keeps the screen free of marks and tokens', () => {
    expect(displayForm('Count the *shapes*.')).toBe('Count the shapes.');
    expect(displayForm('Wait [[pause:short]] ready?')).toBe('Wait ready?');
  });

  it('leaves an ellipsis on screen, because an ellipsis is punctuation', () => {
    expect(displayForm('Wait… ready?')).toBe('Wait… ready?');
  });

  it('strips every token for a vendor that renders none of them', () => {
    expect(stripProsody('Count the [[emphasis]]shapes[[/emphasis]] [[pause:short]] now.')).toBe(
      'Count the shapes now.',
    );
  });

  it('keeps only what the vendor asked to keep', () => {
    const kept = stripProsody(
      '[[emphasis]]two[[/emphasis]] [[pause:short]] more',
      new Set(['pause'] as const),
    );

    expect(kept).toBe('two [[pause:short]] more');
  });

  it('reports a mark or a token wherever one survived', () => {
    expect(hasProsody('plain text')).toBe(false);
    expect(hasProsody('a *word*')).toBe(true);
    expect(hasProsody('a [[pause:short]] beat')).toBe(true);
    // Called twice on purpose: a stateful regex would answer differently the second time.
    expect(hasProsody('a [[pause:short]] beat')).toBe(true);
  });
});
