import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema } from '@aria/shared';

import { InputSurface } from '@/features/session/components/InputSurface';

const writing = tutorMoveSchema.parse({
  id: 'show-1',
  at: '2026-09-02T00:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'SHOW',
  speech: null,
  display: [{ type: 'workpad', mode: 'answer', prompt: 'Write two sentences about your pet.' }],
  expects: 'text',
});

describe('the writing pad Aria opens', () => {
  it('opens a text area under her prompt and sends what was written as the answer', () => {
    const answer = vi.fn();
    render(
      <InputSurface
        band="middle"
        move={writing}
        voice="ready"
        onAnswer={answer}
        onDrag={() => undefined}
        onSpeech={() => undefined}
      />,
    );

    const pad = screen.getByRole('textbox', { name: 'Write two sentences about your pet.' });
    expect(screen.getByRole('button', { name: 'Send to Aria' })).toBeDisabled();
    fireEvent.change(pad, { target: { value: '  My cat is old. She sleeps all day.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to Aria' }));

    expect(answer).toHaveBeenCalledWith('My cat is old. She sleeps all day.');
    expect(screen.getByText('Sent to Aria.')).toBeInTheDocument();
    expect(pad).toHaveValue('');
  });

  it('keeps the single line for a plain text question', () => {
    render(
      <InputSurface
        band="middle"
        move={{ ...writing, display: [] }}
        voice="ready"
        onAnswer={() => undefined}
        onDrag={() => undefined}
        onSpeech={() => undefined}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to Aria' })).not.toBeInTheDocument();
  });
});
