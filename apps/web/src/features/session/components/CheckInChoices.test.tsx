import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { tutorMoveSchema, type TutorMove } from '@aria/shared';

import { InputSurface } from '@/features/session/components/InputSurface';

function checkIn(): TutorMove {
  return tutorMoveSchema.parse({
    id: 'check-1',
    at: '2026-11-10T20:00:00.000Z',
    protocolVersion: '1.2.0',
    kind: 'CHECK_IN',
    about: 'energy',
    speech: { text: 'Do you want an easy one, or should we stop for today?' },
    display: [
      {
        type: 'text',
        body: 'Do you want an easy one, or should we stop for today?',
        markdown: false,
      },
      {
        type: 'choices',
        options: [
          { id: 'easy', label: 'An easy one' },
          { id: 'stop', label: 'Stop for today' },
        ],
      },
    ],
    expects: 'choice',
  });
}

describe('CheckInChoices (P3-05)', () => {
  it('gives the early band two big buttons that answer with the option id', async () => {
    const onAnswer = vi.fn();
    render(
      <InputSurface
        band="early"
        move={checkIn()}
        onAnswer={onAnswer}
        onDrag={() => undefined}
        onSpeech={() => undefined}
        voice="off"
      />,
    );
    const group = screen.getByRole('group', { name: 'Your answer' });
    expect(group).toHaveClass('answer-tiles');
    await userEvent.click(screen.getByRole('button', { name: 'Stop for today' }));
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('stop');
    expect(screen.getByRole('button', { name: 'An easy one' })).toBeInTheDocument();
  });

  it('can be answered out loud in a voice session', async () => {
    const onSpeech = vi.fn();
    render(
      <InputSurface
        band="middle"
        move={checkIn()}
        onAnswer={() => undefined}
        onDrag={() => undefined}
        onSpeech={onSpeech}
        voice="ready"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Talk to Aria/u }));
    expect(onSpeech).toHaveBeenCalledTimes(1);
  });
});
