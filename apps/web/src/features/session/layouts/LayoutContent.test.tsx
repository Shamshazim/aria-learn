import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { stubSession } from '@/features/session/__fixtures__/session.fixture';
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
