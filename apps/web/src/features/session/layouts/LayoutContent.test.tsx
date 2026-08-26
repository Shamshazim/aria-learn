import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';

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
        <LayoutContent session={waiting()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Aria is listening');
    expect(screen.queryByText('Take your time.')).not.toBeInTheDocument();
    // The card is there and empty: nothing is rendered in the child's place while we wait.
    expect(document.querySelector('.session-card')?.textContent).toBe('');
  });

  it('still shows the sentences of an answer that is still being written', () => {
    render(
      <MemoryRouter>
        <LayoutContent session={{ ...waiting(), state: streamingState() }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Let us count on from four.')).toBeInTheDocument();
  });
});

function baseState(): TutorSession['state'] {
  return {
    band: 'early',
    ended: false,
    moves: [],
    currentMove: null,
    status: 'listening',
    paused: false,
    streaming: null,
  } as unknown as TutorSession['state'];
}

function streamingState(): TutorSession['state'] {
  return {
    ...baseState(),
    streaming: { text: 'Let us count on from four.' },
  } as unknown as TutorSession['state'];
}

function waiting(): TutorSession {
  const noop = (): Promise<void> => Promise.resolve();
  return {
    state: baseState(),
    answer: noop,
    completeDrag: noop,
    speak: noop,
    backchannel: noop,
    confused: noop,
    interrupt: noop,
    pause: noop,
    askQuestion: noop,
    resume: noop,
    leave: noop,
  } as unknown as TutorSession;
}
