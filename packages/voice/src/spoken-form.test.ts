import { describe, expect, it } from 'vitest';

import { spokenForm } from './spoken-form';

/**
 * P2H-08: the forty fixtures the ticket asks for, grouped by what they prove.
 *
 * Every one of them is a sentence a child could actually be read, which is why they are
 * written as pairs rather than as unit tests of the helpers underneath.
 */
describe('spokenForm', () => {
  it.each([
    // Numbers
    ['12 apples', 'twelve apples'],
    ['1,204', 'one thousand two hundred four'],
    ['100', 'one hundred'],
    ['999', 'nine hundred ninety-nine'],
    ['21', 'twenty-one'],
    ['1000000', 'one million'],
    ['2,500,000', 'two million five hundred thousand'],
    ['1,000,000,000', 'one billion'],
    ['0', 'zero'],
    ['3.5', 'three point five'],
    ['0.75', 'zero point seven five'],
    ['-5', 'negative five'],
    ['-12.5', 'negative twelve point five'],
    // Ordinals
    ['1st', 'first'],
    ['2nd', 'second'],
    ['3rd', 'third'],
    ['12th', 'twelfth'],
    ['21st', 'twenty-first'],
    ['40th', 'fortieth'],
    // Money
    ['$3', 'three dollars'],
    ['$1', 'one dollar'],
    ['$1.50', 'one dollar and fifty cents'],
    ['$0.75', 'seventy-five cents'],
    ['$1,204.05', 'one thousand two hundred four dollars and five cents'],
    // Time
    ['3:00', "three o'clock"],
    ['3:45', 'three forty-five'],
    ['12:05', 'twelve oh five'],
    // Percentages
    ['25%', 'twenty-five percent'],
    ['100 %', 'one hundred percent'],
    // Fractions
    ['3/4', 'three fourths'],
    ['1/2', 'one half'],
    ['1/10', 'one tenth'],
    // Expressions
    ['3 + 4', 'three plus four'],
    ['3 × 4', 'three times four'],
    ['3 x 4', 'three times four'],
    ['12 ÷ 4', 'twelve divided by four'],
    ['5 - 3 = 2', 'five minus three equals two'],
    // Abbreviations
    ['Dr. Lee', 'Doctor Lee'],
    ['e.g. one', 'for example one'],
    // Prosody
    ['Count the *shapes*.', 'Count the [[emphasis]]shapes[[/emphasis]].'],
    ['Wait… ready?', 'Wait [[pause:short]] ready?'],
    ['Nearly — try again.', 'Nearly [[pause:short]] try again.'],
    ['Is that right?', 'Is that right?'],
  ])('says %s as %s', (written, expected) => {
    expect(spokenForm(written)).toBe(expected);
  });

  it.each([
    ['/k/', 'phoneme', 'k sound'],
    ['/sh/', 'phoneme', 'sh sound'],
    ['12', 'place-value', 'one two'],
    ['307', 'place-value', 'three zero seven'],
  ] as const)('reads %s in the %s context', (written, context, expected) => {
    expect(spokenForm(written, context)).toBe(expected);
  });

  it('leaves a number too long to be a quantity for the engine to read', () => {
    expect(spokenForm('1234567890123')).toBe('1234567890123');
  });
});
