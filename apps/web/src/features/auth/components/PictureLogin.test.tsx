import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PictureLogin } from '@/features/auth/components/PictureLogin';

describe('the picture login', () => {
  it('submits the three pictures in the order they were tapped', async () => {
    const onSubmit = vi.fn();
    render(<PictureLogin onSubmit={onSubmit} />);

    for (const name of ['Fox', 'Star', 'Whale']) {
      await userEvent.click(screen.getByRole('button', { name }));
    }

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(['fox', 'star', 'whale']);
  });

  /** A child who cannot read still hears how far along they are. */
  it('says how many pictures have been tapped', async () => {
    render(<PictureLogin onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Owl' }));

    expect(screen.getByText('1 of 3 pictures tapped')).toBeInTheDocument();
  });

  it('gives every picture a name a screen reader can say', () => {
    render(<PictureLogin onSubmit={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(6);
    for (const name of ['Fox', 'Owl', 'Whale', 'Rocket', 'Apple', 'Star']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
