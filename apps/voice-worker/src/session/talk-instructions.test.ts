import { describe, expect, it } from 'vitest';

import type { VoiceBrief } from '@aria/shared';

import {
  buildTalkInstructions,
  crisisInstruction,
  openingInstruction,
  screenAnswerInstruction,
  silenceInstruction,
  typedOnScreen,
} from '@/session/talk-instructions';

const BRIEF: VoiceBrief = {
  connectionEpoch: 2,
  student: { firstName: 'Sam', grade: '4', band: 'middle' },
  subject: 'mathematics',
  skill: {
    code: 'MATH.G4.U01.L02.T03',
    name: 'Rounding to tens and hundreds',
    unit: 'Place value',
    lesson: 'Rounding',
    objectives: ['Round to the nearest ten'],
  },
  note: null,
  openQuestion: {
    id: 'ask-1',
    prompt: 'Round 468 to the nearest ten.',
    answerKey: '470',
    options: [],
  },
  memory: ['Likes frogs.'],
  minutesLeft: 12,
};

describe('the brief the realtime model teaches from', () => {
  it('puts the child, the topic, the open question, its key and the memory in the prompt', () => {
    const text = buildTalkInstructions(BRIEF);
    for (const expected of [
      'Sam',
      'grade 4',
      'Rounding to tens and hundreds',
      'Place value > Rounding',
      '- Round to the nearest ten',
      'Round 468 to the nearest ten.',
      '"470"',
      'Likes frogs.',
      '12 minutes',
      'record_answer',
      'end_session',
      'show_on_screen',
      'surface "writing"',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('never says the model is an AI and never asks for personal information', () => {
    const text = buildTalkInstructions(BRIEF);
    expect(text).toContain('never say you are an AI');
    expect(text).toContain('Never ask for or repeat personal information');
  });

  it('leaves the name out when the parent did not share it', () => {
    const text = buildTalkInstructions({
      ...BRIEF,
      student: { ...BRIEF.student, firstName: null },
      memory: [],
    });
    expect(text).toContain('the child');
    expect(text).toContain('do not ask for it');
    expect(text).not.toContain('Sam');
  });

  it('writes the opening, the silence rung and the crisis line as instructions', () => {
    expect(openingInstruction(BRIEF, ['Round 468.'])).toContain('Greet Sam');
    expect(openingInstruction(BRIEF, ['Round 468.'])).toContain('Round 468.');
    expect(silenceInstruction([])).toContain('gone quiet');
    expect(crisisInstruction('I am here.')).toContain('"I am here."');
  });

  it('tells the model what the child did on the screen, and how it was graded', () => {
    const text = screenAnswerInstruction('apple', {
      verdict: 'correct',
      teacher_says: ['Yes, apple is a noun.'],
      session_over: false,
      instruction: 'Respond in your own words.',
    });
    expect(text).toContain('answered on the screen: "apple". It was correct.');
    expect(text).toContain('Yes, apple is a noun.');
    expect(screenAnswerInstruction('7', { verdict: 'not_yet', teacher_says: [], session_over: false, instruction: 'x' })).toContain('not right yet');
    expect(typedOnScreen('hello')).toBe('(typed on the screen) hello');
  });
});
