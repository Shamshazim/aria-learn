import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import { composeScreen } from '@/features/session/model/screen-composition';

function move(kind: TutorMove['kind'], extra: Record<string, unknown> = {}): TutorMove {
  return tutorMoveSchema.parse({
    id: `${kind.toLowerCase()}-${String(Object.keys(extra).length)}`,
    at: '2026-09-02T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    kind,
    speech: null,
    display: [],
    expects: 'none',
    ...extra,
  });
}

const QUESTION = move('ASK', {
  speech: { text: 'What is four plus three?' },
  expects: 'text',
  display: [{ type: 'text', body: 'What is four plus three?', markdown: false }],
});

describe('what the screen shows', () => {
  it('shows nothing before the first move', () => {
    expect(composeScreen({ currentMove: null, openQuestion: null })).toEqual({
      cards: [],
      input: null,
    });
  });

  it('gives the open question the control while a hint is shown above it', () => {
    const hint = move('HINT', { speech: { text: 'Count on from four.' } });
    const screen = composeScreen({ currentMove: hint, openQuestion: QUESTION });
    expect(screen.cards.map((card) => card.kind)).toEqual(['HINT', 'ASK']);
    expect(screen.input?.id).toBe(QUESTION.id);
  });

  it('keeps a number pad Aria put up from taking the question over', () => {
    const shown = move('SHOW', { expects: 'number', display: [{ type: 'text', body: '4 + 3' }] });
    const screen = composeScreen({ currentMove: shown, openQuestion: QUESTION });
    expect(screen.input?.id).toBe(QUESTION.id);
    expect(screen.input?.expects).toBe('text');
  });

  it('lets a writing pad dress a question that expects typed words', () => {
    const pad = move('SHOW', {
      expects: 'text',
      display: [{ type: 'workpad', mode: 'answer', prompt: 'Write your answer here.' }],
    });
    const screen = composeScreen({ currentMove: pad, openQuestion: QUESTION });
    expect(screen.cards).toEqual([pad]);
    expect(screen.input?.id).toBe(QUESTION.id);
    expect(screen.input?.display).toEqual(pad.display);
  });

  it('does not let a writing pad dress a question that expects a tap', () => {
    const choice = { ...QUESTION, expects: 'choice' as const };
    const pad = move('SHOW', {
      expects: 'text',
      display: [{ type: 'workpad', mode: 'answer' }],
    });
    const screen = composeScreen({ currentMove: pad, openQuestion: choice });
    expect(screen.cards.map((card) => card.kind)).toEqual(['SHOW', 'ASK']);
    expect(screen.input).toBe(choice);
  });

  it('shows a move on its own once nothing is waiting for an answer', () => {
    const praise = move('PRAISE', { speech: { text: 'Yes.' }, because: 'counted on' });
    expect(composeScreen({ currentMove: praise, openQuestion: null })).toEqual({
      cards: [praise],
      input: praise,
    });
  });
});
