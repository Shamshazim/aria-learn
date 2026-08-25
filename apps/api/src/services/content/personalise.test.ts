import { describe, expect, it } from 'vitest';

import { hasProsody } from '@aria/voice';

import { askSpeech } from '@/services/content/personalise';

describe('early-band emphasis', () => {
  it('leans on the word the question turns on', () => {
    expect(askSpeech('How many quarters make a whole?', 'early')).toEqual({
      text: 'How many quarters make a whole?',
      prosody: 'How many [[emphasis]]quarters[[/emphasis]] make a whole?',
    });
  });

  it('falls back to the thing being asked about', () => {
    expect(askSpeech('Can you find the triangle?', 'early').prosody).toBe(
      'Can you find the [[emphasis]]triangle[[/emphasis]]?',
    );
  });

  it('reads the numbers while it is there', () => {
    expect(askSpeech('How many blocks are in 12 groups?', 'early').prosody).toBe(
      'How many [[emphasis]]blocks[[/emphasis]] are in twelve groups?',
    );
  });

  it('says nothing extra to the older bands', () => {
    expect(askSpeech('How many quarters make a whole?', 'middle')).toEqual({
      text: 'How many quarters make a whole?',
    });
    expect(askSpeech('How many quarters make a whole?', 'senior').prosody).toBeUndefined();
  });

  it('emphasises neither when the same word appears twice', () => {
    expect(askSpeech('Which shape matches this shape?', 'early').prosody).toBeUndefined();
  });

  it('leaves a question with nothing to lean on alone', () => {
    expect(askSpeech('What is it?', 'early').prosody).toBeUndefined();
  });

  /** The acceptance criterion, stated as a test: nothing on screen carries a marker. */
  it('never puts a marker in the text a child reads', () => {
    const prompts = [
      'How many quarters make a whole?',
      'Can you find the triangle?',
      'Which animal is bigger?',
      'What is 3 + 4?',
    ];

    for (const prompt of prompts) {
      const speech = askSpeech(prompt, 'early');

      expect(hasProsody(speech.text)).toBe(false);
      expect(speech.text).toBe(prompt);
    }
  });
});
