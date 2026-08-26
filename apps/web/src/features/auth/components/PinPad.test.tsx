import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PinPad } from '@/features/auth/components/PinPad';

describe('the PIN pad', () => {
  it('submits itself on the fourth digit and starts again empty', async () => {
    const onSubmit = vi.fn();
    render(<PinPad onSubmit={onSubmit} />);

    for (const digit of ['4', '3', '2', '1']) {
      await userEvent.click(screen.getByRole('button', { name: digit }));
    }

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('4321');
    expect(screen.getByText('0 of 4 digits entered')).toBeInTheDocument();
  });

  it('says how far along the child is, out loud', async () => {
    render(<PinPad onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '7' }));

    expect(screen.getByText('1 of 4 digits entered')).toBeInTheDocument();
  });

  it('lets a child take a digit back, and does nothing when there is none', async () => {
    const onSubmit = vi.fn();
    render(<PinPad onSubmit={onSubmit} />);
    const undo = screen.getByRole('button', { name: 'Undo' });

    expect(undo).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(undo);

    expect(screen.getByText('0 of 4 digits entered')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts nothing while an attempt is in flight', async () => {
    const onSubmit = vi.fn();
    render(<PinPad disabled onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: '1' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
