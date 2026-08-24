import { render, screen } from '@testing-library/react';
import { run as axeRun } from 'axe-core';
import { describe, expect, it } from 'vitest';

import { MOVE_KINDS, type Band, type TutorMove } from '@aria/shared';

import { InputSurface } from '@/features/session/components/InputSurface';
import { TutorStatus } from '@/features/session/components/TutorStatus';
import { createEventFactory, type EventPayload } from '@/features/session/model/input-events';
import { MoveView } from '@/features/session/render/registry';
import { createScriptedSource } from '@/features/session/sources/scripted-source';

const BANDS: readonly Band[] = ['early', 'middle', 'senior'];

describe('move renderer registry', () => {
  it('renders every move accessibly in every band', async () => {
    const moves = await allMoveKinds();

    for (const band of BANDS) {
      for (const move of moves) {
        const view = render(<MoveView band={band} move={move} />);
        expect(
          view.container.querySelector(`[data-move-kind="${move.kind}"]`) ?? view.container,
        ).not.toBeEmptyDOMElement();
        const result = await axeRun(view.container, {
          rules: { 'color-contrast': { enabled: false } },
        });
        expect(result.violations).toEqual([]);
        view.unmount();
      }
    }
  });

  it('shows all tutor states as language rather than a spinner', () => {
    const view = render(
      <>
        {(['thinking', 'speaking', 'listening', 'waiting'] as const).map((status) => (
          <TutorStatus key={status} status={status} />
        ))}
      </>,
    );

    expect(screen.getAllByRole('status')).toHaveLength(4);
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeInTheDocument();
  });

  it('uses speech instead of typed text for an early learner', async () => {
    const ask = (await allMoveKinds()).find((move) => move.kind === 'ASK');
    expect(ask).toBeDefined();
    if (ask === undefined) return;
    const textMove: TutorMove = { ...ask, display: [], expects: 'text' };

    render(<InputSurface band="early" move={textMove} onAnswer={() => undefined} />);

    expect(screen.getByRole('button', { name: /Talk to Aria/u })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

async function allMoveKinds(): Promise<readonly TutorMove[]> {
  const source = createScriptedSource();
  let sequence = 0;
  const make = createEventFactory({
    nextId: () => `render-event-${String(++sequence)}`,
    now: () => new Date('2026-08-24T12:00:00Z'),
  });
  const payloads: readonly EventPayload[] = [
    { kind: 'ARRIVED', grade: '4' },
    { kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false },
    { kind: 'ANSWER', respondsTo: 'ask-1', text: '6' },
    { kind: 'ANSWER', respondsTo: 'ask-2', text: '6' },
    { kind: 'ANSWER', respondsTo: 'ask-3', text: '7' },
    { kind: 'CONFUSED' },
    { kind: 'SILENCE', waitedMs: 18_000 },
    { kind: 'PAUSE' },
    { kind: 'RESUME' },
    { kind: 'LEAVE', reason: 'done' },
  ];
  const byKind = new Map<TutorMove['kind'], TutorMove>();
  for (const payload of payloads) {
    for await (const move of source.send(make(payload))) byKind.set(move.kind, move);
  }
  source.close();
  return MOVE_KINDS.flatMap((kind) => {
    const move = byKind.get(kind);
    return move === undefined ? [] : [move];
  });
}
