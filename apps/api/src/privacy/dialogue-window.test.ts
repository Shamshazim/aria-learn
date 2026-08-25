import { describe, expect, it } from 'vitest';

import { renderDialogue } from '@/ai/prompts/render/dialogue.render';
import {
  DIALOGUE_TOKEN_CAP,
  estimateDialogueTokens,
  SAFETY_REDACTION,
  scrubLearnerContext,
  type RawDialogueTurn,
} from '@/privacy';

const IDENTIFIERS = {
  fullName: 'Priya Shah',
  parentEmail: 'anita.shah@example.test',
  address: '14 Maple Street',
  school: 'Bramble Hill Elementary School',
  phone: '555-123-4567',
};

/** Everything a child might volunteer mid-lesson, in the child's own turns. */
const LEAKY_TURNS: readonly RawDialogueTurn[] = [
  { speaker: 'child', text: 'My name is Priya Shah and I am in grade three.' },
  { speaker: 'aria', text: 'Nice to meet you. What is four plus three?' },
  { speaker: 'child', text: 'I go to Bramble Hill Elementary School.' },
  { speaker: 'child', text: 'We live at 14 Maple Street, come over!' },
  { speaker: 'child', text: 'My mum is anita.shah@example.test if you need her.' },
  { speaker: 'child', text: 'You can call 555-123-4567.' },
];

function windowOf(turns: readonly RawDialogueTurn[], pseudonym: 'include' | 'omit' = 'include') {
  return scrubLearnerContext(
    { identifiers: IDENTIFIERS, pseudonymousFirstName: 'Priya', recentDialogue: turns },
    { pseudonym },
  );
}

describe('dialogue window redaction', () => {
  it.each(['Shah', 'Bramble Hill', '14 Maple Street', 'anita.shah@example.test', '555-123-4567'])(
    'never lets %s reach a rendered prompt',
    (secret) => {
      expect(renderDialogue(windowOf(LEAKY_TURNS))).not.toContain(secret);
    },
  );

  it('keeps the first name when the parent opted in, and drops it when they did not', () => {
    expect(renderDialogue(windowOf(LEAKY_TURNS))).toContain('Priya');
    expect(renderDialogue(windowOf(LEAKY_TURNS, 'omit'))).not.toContain('Priya');
  });

  it('keeps the part of the conversation that is about the lesson', () => {
    const rendered = renderDialogue(windowOf(LEAKY_TURNS));

    expect(rendered).toContain('What is four plus three?');
  });

  it('redacts the parent email as one unit, leaving no local part behind', () => {
    const rendered = renderDialogue(windowOf(LEAKY_TURNS));

    expect(rendered).not.toContain('anita');
    expect(rendered).not.toContain('example.test');
  });
});

describe('safety-flagged turns', () => {
  it('removes the whole turn rather than redacting it word by word', () => {
    const scrubbed = windowOf([
      { speaker: 'child', text: 'What is four plus three?' },
      { speaker: 'child', text: 'my dad hurts me when he is angry', safetyFlagged: true },
    ]);

    const texts = (scrubbed.value.recentDialogue ?? []).map((turn) => turn.text);
    expect(texts).toContain(SAFETY_REDACTION);
    expect(texts.join(' ')).not.toContain('hurts');
    expect(texts.join(' ')).not.toContain('angry');
  });

  it('leaves unflagged turns alone', () => {
    const scrubbed = windowOf([{ speaker: 'child', text: 'I got seven.' }]);

    expect(scrubbed.value.recentDialogue?.[0]?.text).toBe('I got seven.');
  });
});

describe('dialogue token cap', () => {
  const long = (index: number): RawDialogueTurn => ({
    speaker: index % 2 === 0 ? 'child' : 'aria',
    text: `Turn ${String(index)}. ${'word '.repeat(90).trim()}`,
  });

  it('drops the oldest turns first and keeps the newest', () => {
    const turns = Array.from({ length: 32 }, (_value, index) => long(index));

    const kept = windowOf(turns).value.recentDialogue ?? [];

    expect(estimateDialogueTokens(kept)).toBeLessThanOrEqual(DIALOGUE_TOKEN_CAP);
    expect(kept.at(-1)?.text).toContain('Turn 31.');
    expect(kept.at(0)?.text).not.toContain('Turn 0.');
    expect(kept.length).toBeLessThan(turns.length);
  });

  it('never truncates a turn mid-sentence: whole turns go, or none do', () => {
    const turns = Array.from({ length: 32 }, (_value, index) => long(index));

    for (const turn of windowOf(turns).value.recentDialogue ?? []) {
      expect(turn.text.endsWith('word')).toBe(true);
    }
  });

  it('leaves a short conversation untouched', () => {
    const turns: readonly RawDialogueTurn[] = [
      { speaker: 'aria', text: 'What is four plus three?' },
      { speaker: 'child', text: 'Seven.' },
    ];

    expect(windowOf(turns).value.recentDialogue).toHaveLength(2);
  });
});
