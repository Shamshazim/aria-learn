import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import { stubSession } from '@/features/session/__fixtures__/session.fixture';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

function ask(text: string): TutorMove {
  return tutorMoveSchema.parse({
    id: 'ask-1',
    at: '2026-09-04T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    kind: 'ASK',
    skillId: 'MATH.G4.U01.L01.T01',
    itemId: 'item-1',
    attempt: 1,
    speech: { text },
    display: [{ type: 'text', body: text, markdown: false }],
    expects: 'text',
  });
}

function hint(text: string): TutorMove {
  return tutorMoveSchema.parse({
    id: 'hint-1',
    at: '2026-09-04T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    kind: 'HINT',
    attempt: 1,
    speech: { text },
    display: [{ type: 'text', body: text, markdown: false }],
    expects: 'none',
  });
}

/**
 * P2H-11: the app does not talk to cover a silence.
 *
 * "Take your time." used to sit here whenever there was no move — every gap between turns,
 * every reconnect, every moment Aria was still thinking. It read as Aria speaking when she was
 * not, and the silence ladder is the thing that decides whether a silence needs anything said
 * about it. The listening indicator stays; the sentence goes.
 */
describe('the session card with no move', () => {
  it('shows the listening indicator and no placeholder sentence', () => {
    render(
      <MemoryRouter>
        <LayoutContent session={stubSession()} voice="ready" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Aria is listening');
    expect(screen.queryByText('Take your time.')).not.toBeInTheDocument();
    expect(document.querySelector('.session-card')?.textContent).toBe('');
  });

  it('still shows the sentences of an answer that is still being written', () => {
    const session = stubSession({
      streaming: { moveId: 'move-1', text: 'Let us count on from four.' },
    });

    render(
      <MemoryRouter>
        <LayoutContent session={session} voice="ready" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Let us count on from four.')).toBeInTheDocument();
  });
});

describe('the session card beside a talking voice', () => {
  const question = ask('Round 468 to the nearest ten.');
  const live = {
    talks: true,
    transcript: 'Think about the ones digit. Is it five or more?',
    heard: '',
    speaking: true,
  };

  it("shows Aria's own words, keeps the question exact, and drops a hint's stored line", () => {
    const session = stubSession({
      currentMove: hint('Look at the ones digit.'),
      openQuestion: question,
      moves: [question],
    });

    render(
      <MemoryRouter>
        <LayoutContent live={live} session={session} voice="ready" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Think about the ones digit. Is it five or more?')).toBeInTheDocument();
    expect(screen.getAllByText('Round 468 to the nearest ten.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Look at the ones digit.')).not.toBeInTheDocument();
  });

  it('offers to skip an open question, and sends the skip when pressed', () => {
    const skip = vi.fn(() => Promise.resolve());
    const session = { ...stubSession({ currentMove: question, openQuestion: question }), skip };

    render(
      <MemoryRouter>
        <LayoutContent session={session} voice="ready" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Skip this one/u }));
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('has nothing to skip while no question is open', () => {
    render(
      <MemoryRouter>
        <LayoutContent session={stubSession()} voice="ready" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Skip this one/u })).not.toBeInTheDocument();
  });
});
