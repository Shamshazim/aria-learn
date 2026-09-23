import { describe, expect, it } from 'vitest';

import type { VoiceBrief } from '@aria/shared';

import {
  buildTalkInstructions,
  crisisInstruction,
  openingInstruction,
  screenAnswerInstruction,
  screenSkipInstruction,
  silenceInstruction,
  topicChangedLine,
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
      'move_on',
      'end_session',
      'show_on_screen',
      'surface "writing"',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('tells the model how a stuck child is handled, and never to re-ask a fourth time', () => {
    const text = buildTalkInstructions(BRIEF);
    expect(text).toContain('Never ask the same question a fourth time');
    expect(text).toContain('call move_on right away');
    expect(text).toContain('not_engaging');
    expect(text).toContain('Never invent a practice question');
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
      new_topic: null,
      session_over: false,
      instruction: 'Respond in your own words.',
    });
    expect(text).toContain('answered on the screen: "apple". It was correct.');
    expect(text).toContain('Yes, apple is a noun.');
    expect(
      screenAnswerInstruction('7', {
        verdict: 'not_yet',
        teacher_says: [],
        new_topic: null,
        session_over: false,
        instruction: 'x',
      }),
    ).toContain('not right yet');
    expect(typedOnScreen('hello')).toBe('(typed on the screen) hello');
  });

  it('tells the model a skip from the screen is final, and names a new topic when there is one', () => {
    const text = screenSkipInstruction({
      verdict: 'not_yet',
      teacher_says: ['No problem. The answer was 470.'],
      new_topic: '"Counting to 120". Objectives: count to 120.',
      session_over: false,
      instruction: 'Respond in your own words.',
    });
    expect(text).toContain('pressed skip');
    expect(text).toContain('Do not try to keep them on it');
    expect(text).toContain('No problem. The answer was 470.');
    expect(text).toContain('moved to a new topic: "Counting to 120"');
    expect(topicChangedLine(BRIEF)).toBe(
      '"Rounding to tens and hundreds". Objectives: Round to the nearest ten.',
    );
    expect(topicChangedLine({ ...BRIEF, skill: null })).toBeNull();
  });
});
