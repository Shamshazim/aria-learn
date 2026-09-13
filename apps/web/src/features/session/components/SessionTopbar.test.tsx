import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Band } from '@aria/shared';

import { SessionTopbar } from '@/features/session/components/SessionTopbar';

/**
 * The topbar names the child whose session it is, and names nobody otherwise.
 *
 * It used to carry a per-band invention — `Mia`, `Noah`, `Sofia` — left over from the first
 * version's mock-ups, so a child in the middle band was greeted as Noah whoever they were.
 */
function renderTopbar(band: Band, learner: Readonly<{ firstName: string }> | null) {
  return render(
    <MemoryRouter>
      <SessionTopbar band={band} learner={learner} subject="mathematics" />
    </MemoryRouter>,
  );
}

describe('the session topbar', () => {
  it.each(['early', 'middle'] as const)('shows the signed-in child in the %s band', (band) => {
    renderTopbar(band, { firstName: 'Ada' });

    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  /** The senior band puts the focus in the middle and the name on the right. */
  it('shows the signed-in child in the senior band too', () => {
    renderTopbar('senior', { firstName: 'Ada' });

    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it.each(['early', 'middle', 'senior'] as const)(
    'names nobody in the %s band when no child session is held',
    (band) => {
      renderTopbar(band, null);

      // The old placeholders, and any other invented name, would fail this: with no child
      // session the learner slot holds the class and nothing that could be read as a person.
      expect(screen.queryByText(/^(Mia|Noah|Sofia)$/u)).not.toBeInTheDocument();
      expect(document.querySelector('.session-learner')?.textContent.trim() ?? '').toBe(
        band === 'senior' ? '' : '· mathematics',
      );
    },
  );

  it('still says which class the session is', () => {
    renderTopbar('middle', { firstName: 'Ada' });

    expect(screen.getByText(/mathematics/u)).toBeInTheDocument();
  });
});
