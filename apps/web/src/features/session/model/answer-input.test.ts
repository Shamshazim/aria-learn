import { describe, expect, it } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { inputModeFor } from '@/features/session/model/answer-input';

function ask(overrides: Partial<TutorMove> & Record<string, unknown>): TutorMove {
  return {
    id: 'ask-1',
    sessionId: 'session-1',
    timestamp: new Date().toISOString(),
    kind: 'ASK',
    skillId: 'reading.main-idea',
    attempt: 1,
    speech: { text: 'What is the story mostly about?' },
    display: [],
    expects: 'text',
    ...overrides,
  } as unknown as TutorMove;
}

describe('inputModeFor', () => {
  it('opens a number keypad for an arithmetic skill', () => {
    expect(inputModeFor(ask({ skillId: 'math.add.within-20' }))).toBe('numeric');
  });

  it('opens a number keypad when the question itself has numbers in it', () => {
    expect(inputModeFor(ask({ speech: { text: 'What is four plus three?' } }))).toBe('numeric');
    expect(
      inputModeFor(ask({ display: [{ type: 'text', body: 'Count to 12.', markdown: false }] })),
    ).toBe('numeric');
  });

  it('opens a keyboard when unsure, because a keyboard can still type a number', () => {
    expect(inputModeFor(ask({}))).toBe('text');
  });

  it('trusts an explicit number expectation', () => {
    expect(inputModeFor(ask({ expects: 'number' }))).toBe('numeric');
  });
});
